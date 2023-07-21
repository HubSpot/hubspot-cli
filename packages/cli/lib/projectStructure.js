const fs = require('fs');
const path = require('path');
const { walk } = require('@hubspot/cli-lib/lib/walk');
const { logger } = require('@hubspot/cli-lib/logger');

const COMPONENT_TYPES = Object.freeze({
  app: 'app',
});

const APP_COMPONENT_CONFIG = 'app.json';

function safeLoadConfigFile(configPath) {
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

function getIsLegacyApp(appConfig, appPath) {
  let cards;

  if (appConfig && appConfig.extensions && appConfig.extensions.crm) {
    cards = appConfig.extensions.crm.cards;
  }

  if (cards) {
    let hasAnyReactExtensions = false;

    cards.forEach(({ file }) => {
      if (!hasAnyReactExtensions) {
        const cardConfigPath = path.join(appPath, file);
        const cardConfig = safeLoadConfigFile(cardConfigPath);

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

  // Assume any app that does not have any cards is not legacy
  return false;
}

async function findProjectComponents(projectSourceDir) {
  let componentsByType = {};

  const projectFiles = await walk(projectSourceDir);

  projectFiles.forEach(projectFile => {
    if (projectFile.endsWith(APP_COMPONENT_CONFIG)) {
      const parsedAppConfig = safeLoadConfigFile(projectFile);

      if (parsedAppConfig && parsedAppConfig.name) {
        const appPath = projectFile.substring(
          0,
          projectFile.indexOf(APP_COMPONENT_CONFIG)
        );
        const isLegacy = getIsLegacyApp(parsedAppConfig, appPath);

        if (!componentsByType[COMPONENT_TYPES.app]) {
          componentsByType[COMPONENT_TYPES.app] = {};
        }

        componentsByType[COMPONENT_TYPES.app][parsedAppConfig.name] = {
          config: parsedAppConfig,
          runnable: !isLegacy,
          path: appPath,
        };
      }
    }
  });

  return componentsByType;
}

module.exports = {
  COMPONENT_TYPES,
  findProjectComponents,
};
