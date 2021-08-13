/**
 * Creates a new Sandbox portal instance.
 * @param {String} name - Name to use for the sandbox.
 * @returns {Object} A new Sandbox portal instance.
 */
async function createSandbox(name) {
  return {
    name,
  };
}

module.exports = {
  createSandbox,
};
