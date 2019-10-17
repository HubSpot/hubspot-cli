const path = require('path');
const { getCwd } = require('@hubspot/cms-lib/path');

function resolveLocalPath(filepath) {
  return filepath && typeof filepath === 'string'
    ? path.resolve(getCwd(), filepath)
    : // Use CWD if optional filepath is not passed.
      getCwd();
}

module.exports = {
  resolveLocalPath,
};
