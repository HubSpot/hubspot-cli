const path = require('path');
const fs = require('fs-extra');
const { version } = require('../package.json');

const {
  logFileSystemErrorInstance,
} = require('@hubspot/cms-lib/errorHandlers');
const { getPortalId } = require('@hubspot/cms-lib');
const { logger } = require('@hubspot/cms-lib/logger');
const { createProject } = require('@hubspot/cms-lib/projects');
const { createFunction } = require('@hubspot/cms-lib/functions');

const { addLoggerOptions, setLogLevel } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const {
  trackCommandUsage,
  addHelpUsageTracking,
} = require('../lib/usageTracking');
const { createFunctionPrompt } = require('../lib/createFunctionPrompt');
const { createTemplatePrompt } = require('../lib/createTemplatePrompt');
const { createModulePrompt } = require('../lib/createModulePrompt');
const { commaSeparatedValues } = require('../lib/text');

const COMMAND_NAME = 'create';

const TYPES = {
  function: 'function',
  module: 'module',
  template: 'template',
  'website-theme': 'website-theme',
  'react-app': 'react-app',
  'webpack-serverless': 'webpack-serverless',
};

const ASSET_PATHS = {
  [TYPES.module]: path.resolve(__dirname, '../defaults/Sample.module'),
  [TYPES.template]: {
    'page-template': path.resolve(__dirname, '../defaults/page-template.html'),
    partial: path.resolve(__dirname, '../defaults/partial.html'),
    'global-partial': path.resolve(
      __dirname,
      '../defaults/global-partial.html'
    ),
    'email-template': path.resolve(
      __dirname,
      '../defaults/email-template.html'
    ),
    'blog-template': path.resolve(__dirname, '../defaults/blog-template.html'),
    'search-template': path.resolve(
      __dirname,
      '../defaults/search-template.html'
    ),
  },
};

const PROJECT_REPOSITORIES = {
  [TYPES['react-app']]: 'cms-react-boilerplate',
  [TYPES['website-theme']]: 'cms-theme-boilerplate',
  [TYPES['webpack-serverless']]: 'cms-webpack-serverless-boilerplate',
};

const SUPPORTED_ASSET_TYPES = commaSeparatedValues(Object.values(TYPES));

const createModule = (moduleDefinition, name, dest) => {
  const writeModuleMeta = ({ contentTypes, label, global }, dest) => {
    const metaData = {
      label: label,
      css_assets: [],
      external_js: [],
      global: global,
      help_text: '',
      host_template_types: contentTypes,
      js_assets: [],
      other_assets: [],
      smart_type: 'NOT_SMART',
      tags: [],
      is_available_for_new_content: false,
    };

    fs.writeJSONSync(dest, metaData, { spaces: 2 });
  };

  const moduleFileFilter = (src, dest) => {
    const emailEnabled = moduleDefinition.contentTypes.includes('EMAIL');

    switch (path.basename(src)) {
      case 'meta.json':
        writeModuleMeta(moduleDefinition, dest);
        return false;
      case 'module.js':
      case 'module.css':
        if (emailEnabled) {
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const assetPath = ASSET_PATHS.module;
  const folderName = name.endsWith('.module') ? name : `${name}.module`;
  const destPath = path.join(dest, folderName);
  if (fs.existsSync(destPath)) {
    logger.error(`The ${destPath} path already exists`);
    return;
  }
  logger.log(`Creating ${destPath}`);
  fs.mkdirp(destPath);
  logger.log(`Creating module at ${destPath}`);
  fs.copySync(assetPath, destPath, { filter: moduleFileFilter });
};

const createTemplate = (name, dest, type = 'page-template') => {
  const assetPath = ASSET_PATHS[TYPES.template][type];
  const filename = name.endsWith('.html') ? name : `${name}.html`;
  const filePath = path.join(dest, filename);
  if (fs.existsSync(filePath)) {
    logger.error(`The ${filePath} path already exists`);
    return;
  }
  logger.debug(`Making ${dest} if needed`);
  fs.mkdirp(dest);
  logger.log(`Creating file at ${filePath}`);
  fs.copySync(assetPath, filePath);
};

function configureCreateCommand(program) {
  program
    .version(version)
    .description(
      `Create HubSpot CMS assets. Supported assets are ${SUPPORTED_ASSET_TYPES}.`
    )
    // For a theme or function this is `<type> <dest>`
    // TODO: Yargs allows an array of commands.
    .arguments('<type> [name] [dest]')
    .option(
      '--theme-version <theme-version>',
      'Theme boilerplate version to use',
      ''
    )
    .option(
      '--project-version <project-version>',
      'Boilerplate version to use',
      ''
    )
    .action(async (type, name, dest) => {
      setLogLevel(program);
      logDebugInfo(program);
      type = typeof type === 'string' && type.toLowerCase();

      if (type === 'global-partial') {
        logger.error(
          `The asset type ${type} has been deprecated. Please choose the "template" asset and select "global partial".`
        );
        return;
      }

      if (!type || !TYPES[type]) {
        logger.error(
          `The asset type ${type} is not supported. Supported asset types are ${SUPPORTED_ASSET_TYPES}.`
        );
        return;
      }

      // TODO: In yargs use `.implies()`
      switch (type) {
        case TYPES.function:
          dest = name;
          break;
        case TYPES['website-theme']:
        case TYPES['react-app']:
        case TYPES['webpack-serverless']:
          dest = name || type;
          break;
        default:
          break;
      }

      dest = resolveLocalPath(dest);

      try {
        await fs.ensureDir(dest);
      } catch (e) {
        logger.error(`The "${dest}" is not a usable path to a directory`);
        logFileSystemErrorInstance(e, {
          filepath: dest,
          write: true,
        });
        return;
      }

      let commandTrackingContext = { assetType: type };

      switch (type) {
        case TYPES.module: {
          const moduleDefinition = await createModulePrompt();
          createModule(moduleDefinition, name, dest);
          break;
        }
        case TYPES.template: {
          if (!name) {
            logger.error(`The 'name' argument is required.`);
            return;
          }

          const { templateType } = await createTemplatePrompt();

          commandTrackingContext.templateType = templateType;
          createTemplate(name, dest, templateType);
          break;
        }
        case TYPES['website-theme']:
          createProject(dest, type, PROJECT_REPOSITORIES[type], 'src', program);
          break;
        case TYPES['react-app']:
        case TYPES['webpack-serverless']: {
          createProject(dest, type, PROJECT_REPOSITORIES[type], '', program);
          break;
        }
        case TYPES.function: {
          const functionDefinition = await createFunctionPrompt();
          createFunction(functionDefinition, dest);
          break;
        }
        default:
          break;
      }

      trackCommandUsage(COMMAND_NAME, commandTrackingContext, getPortalId());
    });

  addLoggerOptions(program);
  addHelpUsageTracking(program, COMMAND_NAME);
}

module.exports = {
  configureCreateCommand,
};
