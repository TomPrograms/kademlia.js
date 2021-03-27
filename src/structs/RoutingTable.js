const utils = require("../utils.js");
const KBucket = require("./Kbucket.js");

module.exports = class RoutingTable {
  constructor(kademlia, kValue, ownNodeId) {
    this.kademlia = kademlia;
    this.kValue = kValue;
    this.ownNodeId = ownNodeId;

    this.buckets = [
      new KBucket(
        this.kademlia,
        this.kValue,
        0n,
        2n ** BigInt(this.kademlia.B) - 1n
      ),
    ];
  }

  hasNodeById(id) {
    let bucketIndex = this.getBucketIndex(id);
    return this.buckets[bucketIndex].hasNodeById(id);
  }

  closestNodes(id, exclude) {
    let allNodes = [];
    this.buckets.forEach(
      (bucket) => (allNodes = allNodes.concat([...bucket.nodes.values()]))
    );
    if (exclude) {
      allNodes = allNodes.filter((node) => {
        return !(
          node.id.hex === exclude.id.hex &&
          node.ip === exclude.ip &&
          node.port === exclude.port
        );
      });
    }
    allNodes.sort((one, two) => {
      let distanceOne = utils.distance(one.id, id);
      let distanceTwo = utils.distance(two.id, id);
      if (distanceOne === distanceTwo) return 0;
      else if (distanceOne > distanceTwo) return 1;
      else if (distanceOne < distanceTwo) return -1;
    });
    allNodes = allNodes.splice(0, this.kValue);

    allNodes.forEach((node) => {
      let bucketToUpdate = this.buckets[this.getBucketIndex(node.id)];
      bucketToUpdate.resetRefreshTimer();
    });

    return allNodes;
  }

  getBucketIndex(nodeId) {
    for (let i = 0; i < this.buckets.length; i++) {
      if (this.buckets[i].idWithin(nodeId)) return i;
    }
  }

  remove(node) {
    let bucketIndex = this.getBucketIndex(node.id);
    this.buckets[bucketIndex].remove(node);
  }

  insert(node) {
    let targetBucketIndex = this.getBucketIndex(node.id);
    let targetBucket = this.buckets[targetBucketIndex];

    // if the bucket isn't full, just insert node
    if (!targetBucket.isFull) {
      targetBucket.insert(node);
    } else {
      if (
        targetBucket.idWithin(this.ownNodeId) ||
        targetBucket.depth % 5 !== 0
      ) {
        let { bucketOne, bucketTwo } = targetBucket.split();
        this.buckets[targetBucketIndex] = bucketOne;
        this.buckets.splice(targetBucketIndex + 1, 0, bucketTwo);

        // finally insert new node
        this.insert(node);
      } else {
        targetBucket.insert(node);
      }
    }
  }
};
