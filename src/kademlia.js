const ID = require("./structs/ID.js");
const Node = require("./structs/Node.js");
const RPC = require("./rpc.js");
const RoutingTable = require("./structs/RoutingTable.js");
const { ValueLookup, NodeLookup } = require("./structs/Lookup.js");
const utils = require("./utils.js");

class MemoryStorageAdapter {
  constructor(kademlia, republish, republishInterval) {
    this.kademlia = kademlia;
    this.republish = republish;
    this.republishInterval = republishInterval;
    this.data = {};
  }

  remove(key) {
    if (!this.data[key]) return;
    clearTimeout(this.data[key].expireTimeout);
    if (this.republish) clearInterval(this.data[key].republishFunction);
    this.data[key] = undefined;
  }

  get(key) {
    if (this.data[key]) return this.data[key].value;
  }

  set(key, value, ttl) {
    this.remove(key);

    this.data[key] = {
      value,
      expireTimeout: setTimeout(() => {
        this.remove(key);
      }, ttl),
      timestamp: Date.now(),
      ttl: ttl,
    };

    if (this.republish) {
      this.data[key].republishFunction = setInterval(() => {
        this.kademlia.setOntoNetwork(key, value.value);
      }, this.republishInterval);
    }
  }

  getValueKeyPairs() {
    return Object.entries(this.data);
  }
}

/**
 * Create a new Kademlia node.
 * @param {Integer} port - Port to bind Kademlia node to. Must be valid, unbound port number.
 * @param {Object} [options] - Options dictionary.
 *
 * @param {String} [options.id] - Hex string of node ID to use. If none provided, defaults to random hex string.
 * @param {Integer} [options.k=20] - K-Value to use for the node. Must be integer greater or equal to 1.
 * @param {Integer} [options.alpha=3] - Alpha value to use for the node. Must be integer greater or equal to 1.
 * @param {Integer} [options.B=256] - Bit size of keys and IDs on the network. Must be a positive integer, and a multiple of 8.
 * @param {Boolean} [options.cache=true] - Whether or not after a value lookup to cache the value on the closest node we queries which did not return the value.
 * @param {String} [options.hash=sha3-256] - Hash function to use. Must have digest size of b and be a valid algorithm compatible with the algorithm parameter for https://nodejs.org/api/crypto.html#crypto_crypto_createhash_algorithm_options
 *
 * @param {Boolean} [options.encrypted=false] - Whether communicates between nodes are encrypted. If true, options.encrypt and options.decrypt must also be passed.
 * @param {Function} [options.encrypt] - Sync function to encrypt outgoing data (only used if options.encrypted==true).
 * @param {Function} [options.decrypt] - Sync function to decrypt incoming data (only used if options.encrypted==true). Should return null if data couldn't be decrypted.
 *
 * @param {Integer} [options.ttl=86400000] - The maximum time (in millseconds) a value has to live before expiring.
 * @param {Boolean} [option.scalettl=true] - If true, the ttl of keys is inversely proportional to the number of nodes in the storer's routing table closer to the key than the storer.
 * @param {Function} [options.scalettlFunction] - Alternative function to scale ttl. Must accept number of nodes in the storer's routing table closer to the key than the storer and the k-value of the storer, and return a ttl in millseconds.
 *
 * @param {Boolean} [options.republish=true] - Should nodes republish data they're storing.
 * @param {Integer} [options.republishInterval=3600000] - Repeating interval after being set, which key-value pairs should be republished to the network by nodes.
 * @param {Integer} [options.timeout=5000] - Time a RPC request is willing to wait for a response before expiring.
 */
module.exports = class Kademlia {
  constructor(port, options = {}) {
    this.port = port;

    this.B = options.B || 256;
    if (this.B % 8 !== 0) throw new Error("B must be a multiple of 8.");
    this.hashFunction = utils.createHashFunction(options.hash || "sha3-256");

    this.a = options.a || 3;
    this.k = options.k || 20;
    if (options.id) {
      this.id = new ID(options.id);
    } else {
      this.id = new ID();
      this.id.generate(this.B);
    }
    this.timeout = options.timeout || 5000;
    this.cache = options.cache || true;

    this.republishInterval = options.republishInterval || 60 * 60 * 1000;
    this.republish = options.republish || true;

    this.ttl = options.ttl || 24 * 60 * 60 * 1000;
    this.scalettl = options.scalettl || true;
    this.scalettlFunction =
      options.scalettlFunction ||
      function (c, k) {
        return k / 20 / (0.00001 * c) ** 2;
      };

    this.encrypted = options.encrypted || false;
    this.encrypt = options.encrypt;
    this.decrypt = options.decrypt;

    this.rpc = new RPC(
      { id: this.id, ip: this.ip, port: this.port },
      this.messageHandler.bind(this),
      this.contactHandler.bind(this),
      this.failureHandler.bind(this),
      this.timeout,
      this.encrypted,
      this.encrypt,
      this.decrypt,
      this.B
    );
    this.storageAdapter =
      options.storageAdapter ||
      new MemoryStorageAdapter(this, this.republish, this.republishInterval);
    this.routingTable = new RoutingTable(this, this.k, this.id);
  }

  messageHandler(message, replyFunction) {
    switch (message.method) {
      case "PING":
        replyFunction("PONG");
        break;

      case "STORE":
        let datattl;
        if (!this.scalettl) datattl = this.ttl;
        else {
          let allNodes = [];
          this.routingTable.buckets.forEach(
            (bucket) => (allNodes = allNodes.concat([...bucket.nodes.values()]))
          );

          let numberCloser = 0;
          let ourDistance = utils.distance(this.id, new ID(message.key));
          allNodes.forEach((node) => {
            if (ourDistance > utils.distance(node.id, new ID(message.key)))
              numberCloser++;
          });

          if (numberCloser === 0) datattl = this.ttl;
          else {
            datattl = Math.min(
              this.ttl,
              Math.round(this.scalettlFunction(numberCloser, this.k))
            );
          }
        }
        this.storageAdapter.set(message.key, message.value, datattl);
        replyFunction("SUCCESS");
        break;

      case "FIND_NODE":
        let nodes = this.routingTable.closestNodes(
          new ID(message.value),
          message.nodeFrom
        );
        replyFunction(nodes);
        break;

      case "FIND_VALUE":
        let databaseValue = this.storageAdapter.get(message.value);
        if (databaseValue) replyFunction(databaseValue);
        else
          replyFunction(
            this.routingTable.closestNodes(
              new ID(message.value),
              message.nodeFrom
            )
          );
        break;
    }
  }

  contactHandler(node) {
    // check if node is new, and if so send them any relevant key-value pairs
    if (!this.routingTable.hasNodeById(node.id)) {
      this.storageAdapter.getValueKeyPairs().forEach((pair) => {
        let [key, value] = pair;
        let keyId = new ID(key);
        let closestNodes = this.routingTable.closestNodes(keyId, node);
        if (closestNodes.length === 0) return;
        let localNodeClosest =
          utils.distance(this.id, keyId) <
          utils.distance(closestNodes[0].id, keyId);
        if (localNodeClosest) {
          let newNodeNeedsKey =
            utils.distance(node.id, keyId) <
            utils.distance(closestNodes[closestNodes.length - 1].id, keyId);
          if (newNodeNeedsKey) {
            this.rpc.sendMessage(
              {
                method: "SET",
                data: {
                  key: keyId.hex,
                  value,
                },
              },
              node,
              () => {}
            );
          }
        }
      });
    }

    this.routingTable.insert(node);
  }

  failureHandler(node) {
    this.routingTable.remove(node);
  }

  async nodeLookup(id) {
    let nodeLookup = new NodeLookup(this, id);
    return await nodeLookup.execute();
  }

  get(key) {
    let keyId = new ID(this.hashFunction(key));
    let valueLookup = new ValueLookup(this, keyId, this.cache);
    return valueLookup.execute();
  }

  async setOntoNetwork(key, value) {
    if (!(key instanceof ID)) key = new ID(key);
    let closest = await this.nodeLookup(key);

    let setRequests = [];
    for (let i = 0; i < closest.length; i++) {
      setRequests.push(
        new Promise((resolve) => {
          let node = closest[i];
          this.rpc.sendMessage(
            {
              method: "STORE",
              data: { key: key.hex, value },
            },
            node,
            function () {
              resolve();
            }
          );
        })
      );
    }

    await Promise.all(setRequests);
  }

  set(key, value) {
    let keyId = new ID(this.hashFunction(key));
    return this.setOntoNetwork(keyId, value);
  }

  async bootstrap(target) {
    if (!target.id) {
      await new Promise((resolve, reject) => {
        this.rpc.sendMessage(
          {
            method: "PING",
          },
          target,
          function (error, message) {
            if (error) return reject("Could not bootstrap onto node.");
            else {
              target.id = message.nodeFrom.id.hex;
              resolve(message);
            }
          }
        );
      });
    }

    if (!(target instanceof Node)) {
      target = new Node(target.id, target.ip, target.port);
    }

    this.routingTable.insert(target);

    await this.nodeLookup(this.id);

    let bucketsToRefresh = this.routingTable.buckets.slice(
      this.routingTable.getBucketIndex(this.id),
      1
    );
    for (let i = 0; i < bucketsToRefresh.length; i++) {
      await bucketsToRefresh[i].refresh();
    }
  }
};
