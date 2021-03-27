const utils = require("../utils.js");

module.exports = class ID {
  constructor(hex) {
    if (hex) {
      this.hex = hex;
      this.id = BigInt("0x" + this.hex);
    }
  }

  generate(B) {
    this.hex = utils.generateRandomHex(B / 8);
    this.id = BigInt("0x" + this.hex);
  }

  inRange(lowerRange, upperRange) {
    return lowerRange <= this.id && this.id <= upperRange;
  }
};
