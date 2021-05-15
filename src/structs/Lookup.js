const Node = require("./Node.js");
const utils = require("../utils.js");

class LookupTable {
  constructor(sizeLimit, target) {
    this.nodes = [];
    this.sizeLimit = sizeLimit;
    this.target = target;
  }

  add(node) {
    let distance = utils.distance(node.id, this.target);
    let data = {
      distance,
      id: node.id.hex,
      node,
      queried: false,
    };

    // if no nodes, just add nodes to list
    if (this.nodes.length === 0) return this.nodes.push(data);

    // else find correct position to insert node in list
    for (let i = 0; i < this.nodes.length; i++) {
      let toCheck = this.nodes[i];
      if (toCheck.id === node.id.hex) return;
      if (distance < toCheck.distance) {
        this.nodes.splice(i, 0, data);
        if (this.nodes.length > this.sizeLimit) {
          this.nodes.pop();
        }
        return;
      }
    }

    // if node to add is smaller than all others, but there is space add it at the end
    if (this.nodes.length < this.sizeLimit) {
      this.nodes.push(data);
    }
  }

  remove(id) {
    for (let i = 0; i < this.nodes.length; i++) {
      let node = this.nodes[i];
      if (node.id === id) {
        this.nodes.splice(i, 1);
      }
    }
  }

  updateQueried(id) {
    for (let i = 0; i < this.nodes.length; i++) {
      let node = this.nodes[i];
      if (node.id === id) {
        this.nodes[i].queried = true;
      }
    }
  }

  hasContactedAll() {
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i].queried === false) return false;
    }
    return true;
  }

  getUncontacted(limit) {
    let nodes = [];
    for (let i = 0; i < this.nodes.length; i++) {
      if (!this.nodes[i].queried) nodes.push(this.nodes[i].node);
      if (nodes.length === limit) return nodes;
    }
    return nodes;
  }

  get(limit) {
    let nodes = [];
    this.nodes.forEach((data) => nodes.push(data.node));
    return nodes.slice(0, limit);
  }
}

class BaseLookup {
  constructor(kademlia, target) {
    this.kademlia = kademlia;
    this.target = target;
    this.lookupTable = new LookupTable(this.kademlia.k, this.target);
    this.lastClosestId = null;
  }

  async lookup() {
    let numberToQuery =
      this.lastClosestId === this.lookupTable.get(1)[0].id.hex
        ? this.kademlia.k
        : this.kademlia.a;
    let nodesToQuery = this.lookupTable.getUncontacted(numberToQuery);

    this.lastClosestId = this.lookupTable.get(1)[0].id.hex;

    let queries = [];
    let responses = [];
    nodesToQuery.forEach((node) => {
      this.lookupTable.updateQueried(node.id.hex);
      queries.push(
        new Promise((resolve, reject) => {
          this.query(node, (error, message) => {
            if (error) {
              this.lookupTable.remove(node.id.hex);
              resolve();
            } else {
              this.lookupTable.add(node);
              responses.push({
                nodeFrom: message.nodeFrom,
                response: message.message,
              });
              resolve();
            }
          });
        })
      );
    });

    await Promise.all(queries);
    return await this.handleResponses(responses);
  }

  execute() {
    let initialNodes = this.kademlia.routingTable.closestNodes(this.target);
    initialNodes.forEach((node) => this.lookupTable.add(node));
    return this.lookup();
  }
}

class NodeLookup extends BaseLookup {
  constructor(kademlia, target) {
    super(kademlia, target);
  }

  query(node, callback) {
    this.kademlia.rpc.sendMessage(
      {
        method: "FIND_NODE",
        data: this.target.hex,
      },
      node,
      callback
    );
  }

  async handleResponses(responses) {
    for (let i = 0; i < responses.length; i++) {
      let response = responses[i].response;
      for (let j = 0; j < response.length; j++) {
        let node = response[j];
        this.lookupTable.add(node);
      }
    }

    if (this.lookupTable.hasContactedAll()) return this.lookupTable.get();
    return await this.lookup();
  }
}

class ValueLookup extends BaseLookup {
  constructor(kademlia, target, cache) {
    super(kademlia, target);
    this.cache = cache;
    if (this.cache) this.closestWithoutValue = new LookupTable(1, this.target);
  }

  query(node, callback) {
    this.kademlia.rpc.sendMessage(
      {
        method: "FIND_VALUE",
        data: this.target.hex,
      },
      node,
      callback
    );
  }

  async handleResponses(responses) {
    for (let i = 0; i < responses.length; i++) {
      let response = responses[i].response;
      if (Array.isArray(response)) {
        if (this.cache) this.closestWithoutValue.add(responses[i].nodeFrom);
        for (let j = 0; j < response.length; j++) {
          let node = response[j];
          this.lookupTable.add(node);
        }
      } else {
        if (this.cache) {
          let nodeToCacheAt = this.closestWithoutValue.get()[0];
          if (nodeToCacheAt !== undefined) {
            await new Promise((resolve) => {
              this.query(nodeToCacheAt, () => resolve());
            });
          }
        }

        return response;
      }
    }

    if (this.lookupTable.hasContactedAll()) return null;
    return await this.lookup();
  }
}

module.exports.NodeLookup = NodeLookup;
module.exports.ValueLookup = ValueLookup;
