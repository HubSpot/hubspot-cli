const { getExt } = require('./path');
const { TEMPLATE_EXTENSION } = require('./lib/constants');

function isTemplate(path) {
  return getExt(path) === TEMPLATE_EXTENSION;
}

module.exports = { isTemplate };
