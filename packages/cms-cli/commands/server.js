#!/usr/bin/env node
const path = require('path');
const shell = require('shelljs');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { getCwd } = require('@hubspot/cms-lib/path');

const { version } = require('../package.json');
const { updateServerContext } = require('../lib/server/updateContext');

const {
  addConfigOptions,
  addLoggerOptions,
  addPortalOptions,
  setLogLevel,
  getPortalId,
} = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');

function configureServerCommand(program) {
  program
    .version(version)
    .description('Run the CMS HubL server')
    .option('--serverConfig <serverConfig>')
    .option('--contextDir [contextDir]')
    .arguments('<src>')
    .action(async (src, options = {}) => {
      setLogLevel(options);
      logDebugInfo(options);
      const { config: configPath, serverConfig, contextDir } = options;
      loadConfig(configPath);
      checkAndWarnGitInclusion();

      if (!validateConfig()) {
        process.exit(1);
      }

      const portalId = getPortalId(options);

      // TODO: add flag to bypass
      logger.log(`Fetching portal data for ${portalId} to update context`);
      await updateServerContext(portalId, path.join(getCwd(), contextDir));

      const cwd = getCwd();
      const cmd = `
    docker run -p 8080:8080 \
    -v ${cwd}/${src}:/local-cms-server/${src} \
    -v ${cwd}/${contextDir}:/local-cms-server/${contextDir} \
    -v ${cwd}/${serverConfig}:/local-cms-server/${serverConfig} \
    hubspot/local-cms-server
  `;

      logger.log('Starting HubSpot CMS HubL server');
      logger.debug(`Running: ${cmd}`);
      shell.exec(cmd, { async: true });
    });

  addLoggerOptions(program);
  addPortalOptions(program);
  addConfigOptions(program);
}

module.exports = {
  configureServerCommand,
};
