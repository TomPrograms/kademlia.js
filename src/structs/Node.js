const ID = require("./ID.js");

module.exports = class Node {
  constructor(nodeId, ip, port) {
    this.id = new ID(nodeId);
    this.ip = ip;
    this.port = port;
  }

  toJSON() {
    return { id: this.id.hex, ip: this.ip, port: this.port };
  }
};
