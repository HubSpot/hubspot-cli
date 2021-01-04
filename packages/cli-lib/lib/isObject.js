function isObject(value) {
  const type = typeof value;
  return value != null && (type === 'object' || type === 'function');
}

module.exports = isObject;
