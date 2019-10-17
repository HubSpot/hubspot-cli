const { upload } = require('@hubspot/cms-lib/api/fileMapper');
const { loadConfig, getPortalId } = require('@hubspot/cms-lib');
const {
  ApiErrorContext,
  logApiUploadErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const { isAllowedExtension } = require('@hubspot/cms-lib/path');
const {
  LOG_LEVEL,
  setLogLevel,
  setLogger,
} = require('@hubspot/cms-lib/logger');

setLogLevel(LOG_LEVEL.LOG);
loadConfig();

const pluginName = 'HubSpotAutoUploadPlugin';

class HubSpotAutoUploadPlugin {
  constructor(options = {}) {
    const { src, dest, portal, autoupload } = options;
    this.src = src;
    this.dest = dest;
    this.autoupload = autoupload;
    this.portalId = getPortalId(portal);
  }

  apply(compiler) {
    const webpackLogger = compiler.getInfrastructureLogger(pluginName);
    setLogger(webpackLogger);
    compiler.hooks.afterEmit.tapPromise(pluginName, async compilation => {
      Object.keys(compilation.assets).forEach(filename => {
        const asset = compilation.assets[filename];
        // assets with `emitted = false` haven't changed since the previous compilation
        if (asset.emitted) {
          const filepath = asset.existsAt;

          if (!this.autoupload || !isAllowedExtension(filepath)) {
            return;
          }

          const dest = `${this.dest}/${filename}`;
          upload(this.portalId, asset.existsAt, dest)
            .then(() => {
              webpackLogger.info(`Uploaded ${dest}`);
            })
            .catch(error => {
              webpackLogger.error(`Uploading ${dest} failed`);
              logApiUploadErrorInstance(
                error,
                new ApiErrorContext({
                  portalId: this.portalId,
                  request: dest,
                  payload: filepath,
                })
              );
            });
        }
      });
    });
  }
}

module.exports = HubSpotAutoUploadPlugin;
