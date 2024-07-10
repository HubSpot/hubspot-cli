const os = require('os');
const { upload } = require('@hubspot/local-dev-lib/api/fileMapper');
const { checkGitInclusion } = require('@hubspot/local-dev-lib/gitignore');
const {
  loadConfig,
  getConfigPath,
  getAccountId,
} = require('@hubspot/local-dev-lib/config');
const { isAllowedExtension } = require('@hubspot/local-dev-lib/path');
const {
  logger,
  LOG_LEVEL,
  setLogLevel,
  setLogger,
} = require('@hubspot/local-dev-lib/logger');

const path = require('path');

setLogLevel(LOG_LEVEL.LOG);

loadConfig();

function checkAndWarnGitInclusion(configPath) {
  try {
    const { inGit, configIgnored } = checkGitInclusion(configPath);

    if (!inGit || configIgnored) return;
    logger.warn('Security Issue Detected');
    logger.warn('The HubSpot config file can be tracked by git.');
    logger.warn(`File "${configPath}"`);
    logger.warn('To remediate:');
    logger.warn(
      `- Move the config file to your home directory: "${os.homedir()}"`
    );
    logger.warn(
      `- Add gitignore pattern "${configPath}" to a .gitignore file in root of your repository.`
    );
    logger.warn(
      '- Ensure that the config file has not already been pushed to a remote repository.'
    );
  } catch (e) {
    // fail silently
    logger.debug(
      'Unable to determine if config file is properly ignored by git.'
    );
  }
}

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
              error.response &&
              error.response.status === 400 &&
              error.response.data &&
              (error.response.data.message || error.response.data.errors)
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
