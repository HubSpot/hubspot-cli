const { upload } = require('@hubspot/cli-lib/api/fileMapper');
const { checkAndWarnGitInclusion } = require('@hubspot/cli-lib');
const {
  loadConfig,
  getConfigPath,
  getAccountId,
} = require('@hubspot/local-dev-lib/config');
const { logger } = require('@hubspot/cli-lib/logger');
const { isAllowedExtension } = require('@hubspot/local-dev-lib/path');
const {
  LOG_LEVEL,
  setLogLevel,
  setLogger,
} = require('@hubspot/cli-lib/logger');
const {
  setLogLevel: setLocalDevLibLogLevel,
} = require('@hubspot/local-dev-lib/logger');
const path = require('path');

setLogLevel(LOG_LEVEL.LOG);
// Update the log level in local-dev-lib's instance of the logger
// This will evenutally replace cli-lib's version of it
setLocalDevLibLogLevel(LOG_LEVEL.LOG);
loadConfig();
checkAndWarnGitInclusion(getConfigPath());

const pluginName = 'HubSpotAutoUploadPlugin';

const parseValidationErrors = (responseBody = {}) => {
  const errorMessages = [];

  const { errors, message } = responseBody;

  if (message) {
    errorMessages.push(message);
  }

  if (errors) {
    const specificErrors = errors.map(error => {
      let errorMessage = error.message;
      if (error.errorTokens && error.errorTokens.line) {
        errorMessage = `line ${error.errorTokens.line}: ${errorMessage}`;
      }
      return errorMessage;
    });
    errorMessages.push(...specificErrors);
  }

  return errorMessages;
};

function logValidationErrors(error, context) {
  const { response = {} } = error;
  const validationErrors = parseValidationErrors(response.body);
  if (validationErrors.length) {
    validationErrors.forEach(err => {
      logger.error(err);
    });
  }
  logger.debug(error);
  logger.debug(context);
}

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
    let isFirstCompile = true;

    compiler.hooks.done.tapPromise(pluginName, async stats => {
      const { compilation } = stats;

      const isAssetEmitted = asset => {
        return (
          compilation.assets[asset].emitted ||
          compilation.emittedAssets.has(asset)
        );
      };

      const assets = Object.keys(compilation.assets).filter(asset => {
        return isFirstCompile || isAssetEmitted(asset);
      });

      isFirstCompile = false;

      assets.forEach(filename => {
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
            const context = {
              accountId: this.accountId,
              request: dest,
              payload: filepath,
              statusCode: error.statusCode,
            };
            if (
              error.statusCode === 400 &&
              error.response &&
              error.response.body &&
              (error.response.body.message || error.response.body.errors)
            ) {
              logValidationErrors(error, context);
            } else {
              console.error(error.message);
              console.debug(error);
              console.debug(context);
            }
          });
      });
    });
  }
}

module.exports = HubSpotAutoUploadPlugin;
