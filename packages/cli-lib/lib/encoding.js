const base64EncodeString = valueToEncode => {
  if (typeof valueToEncode !== 'string') {
    return valueToEncode;
  }

  const stringBuffer = Buffer.from(valueToEncode);
  return encodeURIComponent(stringBuffer.toString('base64'));
};

module.exports = {
  base64EncodeString,
};
