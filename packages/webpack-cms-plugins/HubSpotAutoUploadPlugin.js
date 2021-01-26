const { upload } = require('@hubspot/cli-lib/api/fileMapper');
const {
  loadConfig,
  getAccountId,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('@hubspot/cli-lib/errorHandlers');
const { isAllowedExtension } = require('@hubspot/cli-lib/path');
const {
  LOG_LEVEL,
  setLogLevel,
  setLogger,
} = require('@hubspot/cli-lib/logger');
const path = require('path');
setLogLevel(LOG_LEVEL.LOG);
loadConfig();
checkAndWarnGitInclusion();

const pluginName = 'HubSpotAutoUploadPlugin';

class HubSpotAutoUploadPlugin {
  constructor(options = {}) {
    const { src, dest, portal, account, autoupload } = options;
    this.src = src;
    this.dest = dest;
    this.autoupload = autoupload;
    this.accountId = getAccountId(portal || account);
  }

  apply(compiler) {
    const webpackLogger = compiler.getInfrastructureLogger(pluginName);
    setLogger(webpackLogger);
    compiler.hooks.afterEmit.tapPromise(pluginName, async compilation => {
      Object.keys(compilation.assets).forEach(filename => {
        const outputPath = compilation.getPath(compilation.compiler.outputPath);
        const filepath = path.join(outputPath, filename);

        if (!this.autoupload || !isAllowedExtension(filepath)) {
          return;
        }

        const dest = `${this.dest}/${filename}`;
        upload(this.accountId, filepath, dest)
          .then(() => {
            webpackLogger.info(`Uploaded ${dest} to account ${this.accountId}`);
          })
          .catch(error => {
            webpackLogger.error(`Uploading ${dest} failed`);
            logApiUploadErrorInstance(
              error,
              new ApiErrorContext({
                accountId: this.accountId,
                request: dest,
                payload: filepath,
              })
            );
          });
      });
    });
  }
}

module.exports = HubSpotAutoUploadPlugin;
