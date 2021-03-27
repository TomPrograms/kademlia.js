const Node = require("./Node.js");

module.exports = class Message {
  constructor(message, networkInfo) {
    this.message = message;
    this.networkInfo = networkInfo;
  }

  parse() {
    let parsed;
    try {
      parsed = JSON.parse(this.message);
    } catch {
      return false;
    }

    let nodeId = parsed.idFrom;
    if (!nodeId) return false;

    this.nodeFrom = new Node(
      nodeId,
      this.networkInfo.address,
      this.networkInfo.port
    );

    let replyingTo = parsed.replyingTo;
    let rpcID = parsed.rpcID;
    let message = parsed.message;

    if (!message) return false;

    // if parsing a reply
    if (replyingTo) {
      this.replyingTo = replyingTo;
      this.isReply = true;

      let parsed = [];
      if (Array.isArray(message)) {
        for (let i = 0; i < message.length; i++) {
          let node = message[i];
          if (!node || typeof node !== "object") return false;
          parsed.push(new Node(node.id, node.ip, node.port));
        }
        this.message = parsed;
      } else {
        this.message = message;
      }
    }

    // if parsing a RPC command
    else {
      if (!rpcID) return false;
      this.rpcID = rpcID;
      this.isReply = false;

      let method = message.method;
      let data = message.data;
      this.method = method;

      switch (method) {
        case "PING":
          break;

        case "STORE":
          if (!data) return false;
          if (!data.key) return false;
          if (!data.value) return false;

          this.key = data.key;
          this.value = data.value;

          break;

        case "FIND_NODE":
        case "FIND_VALUE":
          if (!data) return false;

          this.value = data;

          break;

        default:
          return false;
      }
    }

    return true;
  }
};
