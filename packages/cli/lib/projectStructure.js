const fs = require('fs');
const path = require('path');
const { walk } = require('@hubspot/local-dev-lib/fs');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { logErrorInstance } = require('./errorHandlers/standardErrors');

const COMPONENT_TYPES = Object.freeze({
  privateApp: 'private-app',
  publicApp: 'public-app',
  jsRendering: 'js-rendering',
});

const CONFIG_FILES = {
  [COMPONENT_TYPES.privateApp]: 'app.json',
  [COMPONENT_TYPES.publicApp]: 'public-app.json',
  [COMPONENT_TYPES.jsRendering]: 'cms-assets.json',
};

function getTypeFromConfigFile(configFile) {
  for (let key in CONFIG_FILES) {
    if (CONFIG_FILES[key] === configFile) {
      return key;
    }
  }
  return null;
}

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
    const { base, dir } = path.parse(projectFile);

    if (Object.values(CONFIG_FILES).includes(base)) {
      const parsedConfig = loadConfigFile(projectFile);

      if (parsedConfig) {
        if (parsedConfig.label && typeof parsedConfig.outputPath === 'string') {
          components.push({
            type: getTypeFromConfigFile(base),
            config: parsedConfig,
            runnable: true,
            path: dir,
          });
        } else if (parsedConfig.name) {
          const isLegacy = getIsLegacyApp(parsedConfig, dir);

          components.push({
            type: getTypeFromConfigFile(base),
            config: parsedConfig,
            runnable: !isLegacy,
            path: dir,
          });
        }
      }
    }
  });

  return components;
}

module.exports = {
  CONFIG_FILES,
  COMPONENT_TYPES,
  findProjectComponents,
  getAppCardConfigs,
};
