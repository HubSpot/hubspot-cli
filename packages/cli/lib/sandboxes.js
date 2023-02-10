const getSandboxType = type =>
  type === 'DEVELOPER' ? 'development' : 'standard';

function getAccountName(config) {
  const isSandbox =
    config.sandboxAccountType && config.sandboxAccountType !== null;
  const sandboxName = `[${getSandboxType(config.sandboxAccountType)} sandbox] `;
  return `${config.name} ${isSandbox ? sandboxName : ''}(${config.portalId})`;
}

function getSyncTasks(config) {
  if (config.sandboxAccountType === 'DEVELOPER') {
    return [{ type: 'object-schemas' }];
  }
  // TODO: fetch types for standard sandbox sync
  return null;
}

module.exports = {
  getSandboxType,
  getAccountName,
  getSyncTasks,
};
