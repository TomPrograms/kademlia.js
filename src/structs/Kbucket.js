const ID = require("./ID.js");
const utils = require("../utils.js");

module.exports = class KBucket {
  constructor(kademlia, kValue, lowerLimit, upperLimit, depth = 0) {
    this.kademlia = kademlia;
    this.kValue = kValue;
    this.lowerLimit = lowerLimit;
    this.upperLimit = upperLimit;
    this.depth = depth;
    this.refreshFunction = undefined;
    this.resetRefreshTimer();

    this.nodes = new Map();
    this.replacementCache = new Map();
    this.maximumReplacementCache = this.kValue * 5;
  }

  resetRefreshTimer() {
    clearTimeout(this.refreshFunction);
    this.refreshFunction = setTimeout(() => this.refresh(), 1000 * 60 * 60);
  }

  async refresh() {
    let randomId = new ID(
      utils
        .randomNumberInBigIntRange(this.lowerLimit, this.upperLimit)
        .toString(16)
    );
    await this.kademlia.nodeLookup(randomId);
    this.resetRefreshTimer();
  }

  idWithin(id) {
    return id.inRange(this.lowerLimit, this.upperLimit);
  }

  split() {
    let midpoint = (this.lowerLimit + this.upperLimit) / 2n;
    let bucketOne = new KBucket(
      this.kademlia,
      this.kValue,
      this.lowerLimit,
      midpoint,
      this.depth + 1
    );
    let bucketTwo = new KBucket(
      this.kademlia,
      this.kValue,
      midpoint + 1n,
      this.upperLimit,
      this.depth + 1
    );
    let allNodes = [...this.nodes.values(), ...this.replacementCache.values()];
    allNodes.forEach((node) => {
      if (bucketOne.idWithin(node.id)) bucketOne.insert(node);
      else bucketTwo.insert(node);
    });
    return { bucketOne, bucketTwo };
  }

  remove(node) {
    if (this.replacementCache.has(node.id.hex)) {
      this.replacementCache.delete(node.id.hex);
    }

    if (this.nodes.has(node.id.hex)) {
      this.nodes.delete(node.id.hex);

      if (this.replacementCache.size > 0) {
        // get the last entry in map
        let lastKey = [...this.replacementCache.keys()].pop();
        let replacement = this.replacementCache.get(lastKey);
        this.replacementCache.delete(lastKey);

        this.nodes.set(lastKey, replacement);
      }
    }
  }

  insert(node) {
    if (this.nodes.has(node.id.hex)) {
      this.nodes.delete(node.id.hex);
      this.nodes.set(node.id.hex, node);
      return;
    } else if (this.kValue > this.nodes.size) {
      this.nodes.set(node.id.hex, node);
      return;
    }

    if (this.replacementCache.has(node.id.hex)) {
      this.replacementCache.delete(node.id.hex);
      this.replacementCache.set(node.id.hex, node);
      return;
    } else if (this.maximumReplacementCache > this.replacementCache.size) {
      this.replacementCache.set(node.id.hex, node);
      return;
    }
  }

  hasNodeById(id) {
    return this.nodes.has(id.hex);
  }

  getNodeById(id) {
    return this.nodes.get(id.hex);
  }

  get isFull() {
    return this.length >= this.kValue;
  }

  get length() {
    return this.nodes.size;
  }
};
