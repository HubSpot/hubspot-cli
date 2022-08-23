const semver = require('semver');
const { getExt } = require('@hubspot/cli-lib/path');
// This is pulled into it's own file because it must be added to the esignore. Dynamics imports cause eslint _parser_ errors, which cannot be ignored.

/**
 * Takes in a path to a javascript file and either dynamically imports it or requires it, and returns, depending on node version.
 * @param {string} filePath - Path to javascript file
 * @returns {Promise | undefined} - Returns _default_ exported content if ESM, or exported module content if CJS, or undefined if node version < 13.2 and file is .mjs.
 */
async function dynamicImport(filePath) {
  if (semver.gte(process.version, '13.2.0')) {
    const exported = await import(filePath).then(content => content.default);
    return exported;
  } else {
    if (getExt(filePath) == 'mjs') {
      logger.error('.mjs files are only supported when using Node 13.2.0+');
      return undefined;
    }
    return require(filePath);
  }
}

module.exports = { dynamicImport };
