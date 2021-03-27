const dgram = require("dgram");
const utils = require("./utils.js");
const Message = require("./structs/Message.js");

module.exports = class RPC {
  constructor(
    nodeInfo,
    messageHandler,
    contactHandler,
    failureHandler,
    timeout,
    encrypted,
    encrypt,
    decrypt,
    B
  ) {
    this.kademliaId = nodeInfo.id;
    this.ip = nodeInfo.ip;
    this.port = nodeInfo.port;

    this.pending = {};
    this.timeout = timeout;
    this.messageHandler = messageHandler;
    this.contactHandler = contactHandler;
    this.failureHandler = failureHandler;

    this.acceptingMessages = true;

    this.encrypted = encrypted;
    this.encrypt = encrypt;
    this.decrypt = decrypt;

    this.B = B;

    this.socket = dgram.createSocket("udp4");
    this.socket.on("message", this.handleMessage.bind(this));
    this.socket.bind(this.port);
  }

  shutdown() {
    return new Promise((resolve, reject) => {
      this.acceptingMessages = false;
      if (Object.keys(this.pending).length === 0) {
        this.socket.close();
        return resolve();
      }

      setTimeout(() => {
        this.socket.close();
        return resolve();
      }, this.timeout);
    });
  }

  resume() {
    this.acceptingMessages = true;
    this.socket = dgram.createSocket("udp4");
    this.socket.on("message", this.handleMessage.bind(this));
    this.socket.bind(this.port);
  }

  handleMessage(data, networkInfo) {
    if (this.encrypted) data = this.decrypt(data);

    let message = new Message(data, networkInfo);
    let validMessage = message.parse();

    if (!validMessage) return;

    this.contactHandler(message.nodeFrom);
    if (message.replyingTo && this.pending[message.replyingTo]) {
      let data = this.pending[message.replyingTo];
      let callback = data.callback;
      clearTimeout(data.timeout);
      delete this.pending[message.replyingTo];
      callback(null, message);
    } else {
      if (!this.acceptingMessages) return;
      let rpcID = message.rpcID;
      this.messageHandler(message, (reply) => {
        let packet = {
          replyingTo: rpcID,
          message: reply,
          idFrom: this.kademliaId.hex,
        };
        let serializedMessage = JSON.stringify(packet);
        if (this.encrypted) serializedMessage = this.encrypt(serializedMessage);
        this.socket.send(serializedMessage, networkInfo.port, networkInfo.ip);
      });
    }
  }

  sendMessage(message, node, callback) {
    let rpcID = utils.generateRandomHex(this.B / 8);
    let packet = {
      rpcID,
      message,
      idFrom: this.kademliaId.hex,
    };
    let serializedMessage = JSON.stringify(packet);
    if (this.encrypted) serializedMessage = this.encrypt(serializedMessage);

    this.socket.send(serializedMessage, node.port, node.ip, (error) => {
      if (!error) {
        this.pending[rpcID] = {
          callback,
          timeout: setTimeout(() => {
            if (this.pending[rpcID]) {
              let savedCallback = this.pending[rpcID]["callback"];
              delete this.pending[rpcID];
              if (node.id) this.failureHandler(node);
              savedCallback("ERROR-TIMEOUT", null);
            }
          }, this.timeout),
        };
      } else {
        if (node.id) this.failureHandler(node);
        callback("ERROR-NO-CONNECT", null);
      }
    });
  }
};
