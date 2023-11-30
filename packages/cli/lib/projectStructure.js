const fs = require('fs');
const path = require('path');
const { walk } = require('@hubspot/local-dev-lib/fs');
const { logger } = require('@hubspot/cli-lib/logger');
const { logErrorInstance } = require('./errorHandlers/standardErrors');

const COMPONENT_TYPES = Object.freeze({
  app: 'app',
});

const APP_COMPONENT_CONFIG = 'app.json';

function loadConfigFile(configPath) {
  if (configPath) {
    try {
      const source = fs.readFileSync(configPath);
      const parsedConfig = JSON.parse(source);
      return parsedConfig;
    } catch (e) {
      logger.debug(e);
    }
  }
  return null;
}

function getAppCardConfigs(appConfig, appPath) {
  let cardConfigs = [];
  let cards;

  if (appConfig && appConfig.extensions && appConfig.extensions.crm) {
    cards = appConfig.extensions.crm.cards;
  }

  if (cards) {
    cards.forEach(({ file }) => {
      if (typeof file === 'string') {
        const cardConfigPath = path.join(appPath, file);
        const cardConfig = loadConfigFile(cardConfigPath);

        if (cardConfig) {
          cardConfigs.push(cardConfig);
        }
      }
    });
  }

  return cardConfigs;
}

function getIsLegacyApp(appConfig, appPath) {
  const cardConfigs = getAppCardConfigs(appConfig, appPath);

  if (!cardConfigs.length) {
    // Assume any app that does not have any cards is not legacy
    return false;
  }

  let hasAnyReactExtensions = false;

  cardConfigs.forEach(cardConfig => {
    if (!hasAnyReactExtensions) {
      const isReactExtension =
        cardConfig &&
        !!cardConfig.data &&
        !!cardConfig.data.module &&
        !!cardConfig.data.module.file;

      hasAnyReactExtensions = isReactExtension;
    }
  });

  return !hasAnyReactExtensions;
}

async function findProjectComponents(projectSourceDir) {
  const components = [];
  let projectFiles = [];

  try {
    projectFiles = await walk(projectSourceDir);
  } catch (e) {
    logErrorInstance(e);
  }

  projectFiles.forEach(projectFile => {
    // Find app components
    if (projectFile.endsWith(APP_COMPONENT_CONFIG)) {
      const parsedAppConfig = loadConfigFile(projectFile);

      if (parsedAppConfig && parsedAppConfig.name) {
        const appPath = projectFile.substring(
          0,
          projectFile.indexOf(APP_COMPONENT_CONFIG)
        );
        if (typeof appPath === 'string') {
          const isLegacy = getIsLegacyApp(parsedAppConfig, appPath);

          components.push({
            type: COMPONENT_TYPES.app,
            config: parsedAppConfig,
            runnable: !isLegacy,
            path: appPath,
          });
        }
      }
    }
  });

  return components;
}

module.exports = {
  APP_COMPONENT_CONFIG,
  COMPONENT_TYPES,
  findProjectComponents,
  getAppCardConfigs,
};
