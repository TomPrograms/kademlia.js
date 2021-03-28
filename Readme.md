<div align="center">
  <h1>
    <img alt="kademlia.js decentralized network graphic" src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/decentralizedNetworkGraphic.png">
    <br>
    kademlia.js
    <br>
  </h1>

  <h4 align="center">An implementation of the <a href="https://pdos.csail.mit.edu/~petar/papers/maymounkov-kademlia-lncs.pdf" target="_blank">Kademlia</a> distributed hash table, written in Javascript for Node.js.</h4>

  <p>
    <a href="./LICENSE">
      <img src="https://img.shields.io/badge/license-MIT-blue">
    </a>
    <img src="https://img.shields.io/badge/dependencies-0-brightgreen?color=blue">
  </p>

  <p align="center">
    <a href="#overview">Overview</a> •
    <a href="#security-considerations">Security Considerations</a> •
    <a href="#example">Example</a> •
    <a href="#documentation">Documentation</a> • 
    <a href="#credit">Credit</a> •
    <a href="#license">License</a>
  </p>
</div>

## Overview

Kademlia.js is a Javascript implementation of the distributed hash table Kademlia, originally designed in 2002 by Petar Maymounkov and David Mazières. A distributed hash table (DHT) is a key-value data store which can operate distributed across multiple nodes (or computers) on a network. The Kademlia DHT is a peer-to-peer network, and completley decentralized. A Kademlia network in which anyone can participate is a public network, a Kademlia network in which only certain people can participate is a private network.

Nodes on the network share network-wide constants <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/k.svg">, <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/alpha.svg"> and <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/B.svg">. Each node also has an <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/id.svg"> of length <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/B.svg"> bits. <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/k.svg"> defines the amount of nodes a Kademlia instance can keep in each bucket in it's routing table, and the number of nodes each data should be replicated across when setting it to the network. <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/alpha.svg"> defines the number of simultaneous queries a node performs in the lookup stage. <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/B.svg"> defines the length in bits of node ids and data keys. As requiring keys to be exactly <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/B.svg"> bits long is inconvenient, data keys are hashed with a hashing algorithm with digest size <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/B.svg"> bits. The original paper and many implementations of Kademlia use SHA-1 as the hashing algorithm, and a <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/B.svg"> value of 160, however by default this implementation uses the SHA-3-256 with a <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/B.svg"> value of 256, to increase the key space and address security concerns with the SHA-1 hashing algorithm. The hash function must be the same across all nodes in the network.

Kademlia can efficiently fetch and set data to and from the network, with set and get operations scaling with <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/bigONotation.svg">, where <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/n.svg"> is the number of nodes connected to the network. Kademlia uses a recursive algorithm, with <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/alpha.svg"> maximum concurrent queries, to traverse the network to find the nodes with the smallest distance between the key of the data and each node's id (where the distance between two IDs is defined as the XOR of two IDs), and then uses those nodes to either get data from or set data onto the network. After setting data to the network, by default we also store data onto the closest node that we queried that didn't return a value (caching).

Every piece of data stored on each node by default has an expire time in milliseconds of <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/expireFunction.svg">, where the <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/min.svg"> function returns the smallest of the parameters passed, <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/ttl.svg"> is by default 24 hours, and <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/exp.svg"> is some function that returns a value expontentially inversely proportional to the number of nodes in the storers routing table closer to the key of the data to store than the storer (<img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/c.svg">). The number returned by the <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/exp.svg"> function will be rounded. By default the function is:

<img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/defaultExpFunction.svg">

which can alternatively be written:

<img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/alternativeDefaultExpFunction.svg">
 
This behaviour can be disabled, and the time for keys expiring can just be the value of <img src="https://raw.githubusercontent.com/TomPrograms/kademlia.js/master/docs/images/ttl.svg">, however in this case if caching is enabled, this may cause over-caching.

## Security Considerations

Kademlia is a great solution for storing data on decentralized networks, however users do have some security considerations to take into account. First off, the integrity of the data being retrieved from a Kademlia network in which adversial nodes could potentially participate (a public network) is not guaranteed. Therefore the integrity of all important data entered into the network should be authenticatable - possibly with a cryptographic signature.

By default Kademlia nodes communicate unencrypted over UDP. However in private Kademlia networks it may be desirable to encrypt communications between nodes. In this implementation it is possible to encrypt communications between nodes by setting `encrypted` as true, and passing custom `encrypt` and `decrypt` functions to encrypt and decrypt data.

Kademlia lookups are also vulnerable to manipulation by adversaries. If an adversary is encountered during a lookup, they can manipulate the lookup, and likely compromise the lookup so either the wrong data is returned or no data is set to the network. Eclipse attacks or sybil attacks could also be attempted by adversaries to manipulate network operations.

Kademlia nodes also must be bootstrapped with a non-adversarial node, otherwise every node on the network could easily be controlled by an adversary.

These problems can largely be offset by using authenticatable data, bootstrapping to a non-adversarial node, and <a href="https://www.researchgate.net/publication/4319659_SKademlia_A_practicable_approach_towards_secure_key-based_routing" target="_blank">S/Kademlia</a>.

<!--
S/Kademlia is a variation of Kademlia, which improves reliability and security of the Kademlia network, but at the price of requiring extra computational recourses and extra network traffic. An implementation of S/Kademlia can be found here.
-->

## Installation

You can install kademlia.js through NPM, with the command:

```
$ npm i stormdb
```

## Example

> Example: Create a Kademlia node, set data on the network, and then fetch it again.

```js
const Kademlia = require("kademlia.js");

// create a Kademlia node
let node = new Kademlia(5533);

// bootstrap the new node onto the network using the details of a node already in the network
await node.bootstrap({
  ip: otherNodeIp,
  port: otherNodePort,
});

// set data onto the network
await node.set("test-key", "test-data");

// fetch the data we just set back off the network
let fetchedData = node.get("test-key");
assert(fetchedData === "test-data");
```

## Documentation

You can import the library after installing it like so:

```
const Kademlia = require("kademlia.js");
```

Creating a new Kademlia node, providing the port for the Kademlia node, with an optional dictionary containing options for the node:

```js
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
let node = new Kademlia(5533, {});
```

To bootstrap a node onto the network, providing the details of a node:

```js
await node.bootstrap({
  ip: otherNodeIp,
  port: otherNodePort,
});
```

You can then use the node you created to set data to the network:

```js
await node.set("key", "value");
```

You can also retrieve data from the network for a specific key. If that key isn't on the network, `null` is returned.

```js
await node.get("key");
```

If you wanted to use a different hash function, e.g. reverting to the original paper's SHA-1, it could be done when creating a node like so. Note SHA-1 has a digest size of 160 bits, so B is also set as 160, which is okay as it is a multiple of 8.

```js
let node = new Kademlia(5533, {
  hashFunction: "sha-1",
  B: 160,
});
```

Lookups are generally pretty fast, however if the timeout value is large and many offline nodes are encountered during the lookup, this may slow down the lookups greatly. To decrease the effect of offline nodes on the lookup speed, the value of `timeout` can be lowered, however if `timeout` is two low, queries may expire before online nodes get a chance to respond to them.

```js
let node = new Kademlia(5533, {
  timeout: 1000, // 1 second in milliseconds
});
```

It may be desirable for data to be flushed out of the system if not being republished by a user. To achieve this you should disable node's republishing values they're storing and caching. In this scenario it may also be useful to disable ttl scaling.

```js
let node = new Kademlia(5533, {
  cache: false,
  republish: false,
  scalettl: false,
});
```

You can shutdown without destroying a node like so. This will first wait for all outgoing queries to finish and then stop the node's operations:

```js
await node.shutdown();
```

You can resume a shutdown node's operations like so:

```js
node.resume();
```

You can check if a node is running like so:

```js
node.isRunning;
```

On private networks you may want to encrypt communications between Kademlia nodes. You can achieve this like this so:

```js
let node = new Kademlia(5533, {
  encrypted: true,
  encrypt: (data) => encryptionFunction(data),
  decrypt: (data) => decryptionFunction(data),
});
```

## Credit

Implementation Author: [Tom](https://github.com/TomPrograms).

Original Kademlia Designers: Petar Maymounkov and David Mazières.

## License

[MIT](./LICENSE)
