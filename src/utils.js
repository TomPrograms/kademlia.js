const crypto = require("crypto");

module.exports.generateRandomHex = (lengthInBytes) => {
  return crypto.randomBytes(lengthInBytes).toString("hex");
};

module.exports.randomNumberInBigIntRange = (lowerLimit, upperLimit) => {
  let range = upperLimit - lowerLimit;
  let bytesForRange = Buffer.from(range.toString(16), "hex").length;
  let random = BigInt("0x" + crypto.randomBytes(bytesForRange).toString("hex"));
  return lowerLimit + (random % range);
};

module.exports.distance = (idOne, idTwo) => {
  return idOne.id ^ idTwo.id;
};

module.exports.createHashFunction = (hashType) => (data) =>
  crypto.createHash(hashType).update(data).digest().toString("hex");
