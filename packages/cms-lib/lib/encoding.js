const base64EncodeString = valueToEncode => {
  if (typeof valueToEncode !== 'string') {
    return valueToEncode;
  }

  const stringBuffer = Buffer.from(valueToEncode);
  return encodeURIComponent(stringBuffer.toString('base64'));
};

const base64DecodeString = valueToDecode => {
  if (typeof valueToDecode !== 'string') {
    return valueToDecode;
  }

  const decodedURI = decodeURIComponent(valueToDecode);
  const stringBuffer = Buffer.from(decodedURI, 'base64');
  return stringBuffer.toString('ascii');
};

module.exports = {
  base64DecodeString,
  base64EncodeString,
};
