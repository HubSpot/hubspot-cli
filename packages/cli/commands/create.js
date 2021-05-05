const path = require('path');
const ora = require('ora');
const fs = require('fs-extra');
const {
  logFileSystemErrorInstance,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { createProject } = require('@hubspot/cli-lib/projects');
const { createFunction } = require('@hubspot/cli-lib/functions');
const { GITHUB_RELEASE_TYPES } = require('@hubspot/cli-lib/lib/constants');
const { commaSeparatedValues } = require('@hubspot/cli-lib/lib/text');
const { fetchJsonFromRepository } = require('@hubspot/cli-lib/github');
const { commaSeparatedValues } = require('@hubspot/cli-lib/lib/text');

const { setLogLevel, getAccountId } = require('../lib/commonOpts');
const { logDebugInfo } = require('../lib/debugInfo');
const { resolveLocalPath } = require('../lib/filesystem');
const { trackCommandUsage } = require('../lib/usageTracking');
const { createFunctionPrompt } = require('../lib/createFunctionPrompt');
const { createTemplatePrompt } = require('../lib/createTemplatePrompt');
const { createModulePrompt } = require('../lib/createModulePrompt');
const {
  createApiSamplePrompt,
  overwriteSamplePrompt,
} = require('../lib/createApiSamplePrompt');

const TYPES = {
  function: 'function',
  module: 'module',
  template: 'template',
  'api-sample': 'api-sample',
  'website-theme': 'website-theme',
  'react-app': 'react-app',
  'vue-app': 'vue-app',
  'webpack-serverless': 'webpack-serverless',
  app: 'app',
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
    'blog-listing-template': path.resolve(
      __dirname,
      '../defaults/blog-listing-template.html'
    ),
    'blog-post-template': path.resolve(
      __dirname,
      '../defaults/blog-post-template.html'
    ),
    'search-template': path.resolve(
      __dirname,
      '../defaults/search-template.html'
    ),
  },
};

const PROJECT_REPOSITORIES = {
  [TYPES['react-app']]: 'cms-react-boilerplate',
  [TYPES['vue-app']]: 'cms-vue-boilerplate',
  [TYPES['website-theme']]: 'cms-theme-boilerplate',
  [TYPES['webpack-serverless']]: 'cms-webpack-serverless-boilerplate',
  [TYPES['api-sample']]: 'sample-apps-list',
  [TYPES['app']]: 'crm-card-weather-app',
};

const SUPPORTED_ASSET_TYPES = commaSeparatedValues(
  Object.values(TYPES).filter(type => !['api-sample', 'app'].includes(type))
);

const createModule = (moduleDefinition, name, dest) => {
  const writeModuleMeta = ({ contentTypes, moduleLabel, global }, dest) => {
    const metaData = {
      label: moduleLabel,
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

exports.command = 'create <type> [name] [dest]';
exports.describe = `Create HubSpot sample apps and CMS assets. Supported assets are ${SUPPORTED_ASSET_TYPES}.`;

exports.handler = async options => {
  let { type: assetType, name, dest } = options;

  setLogLevel(options);
  logDebugInfo(options);
  assetType = typeof assetType === 'string' && assetType.toLowerCase();

  if (assetType === 'global-partial') {
    logger.error(
      `The asset type ${assetType} has been deprecated. Please choose the "template" asset and select "global partial".`
    );
    return;
  }

  if (!assetType || !TYPES[assetType]) {
    logger.error(
      `The asset type ${assetType} is not supported. Supported asset types are ${SUPPORTED_ASSET_TYPES}.`
    );
    return;
  }

  switch (assetType) {
    case TYPES.function:
      dest = name;
      break;
    case TYPES['website-theme']:
    case TYPES['react-app']:
    case TYPES['vue-app']:
    case TYPES['webpack-serverless']:
    case TYPES['app']:
      dest = name || assetType;
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

  let commandTrackingContext = { assetType: assetType };

  if (
    !name &&
    [TYPES.module, TYPES.template, TYPES['api-sample']].includes(assetType)
  ) {
    logger.error(
      `The 'name' argument is required when creating a ${assetType}.`
    );
    return;
  }

  switch (assetType) {
    case TYPES.module: {
      const moduleDefinition = await createModulePrompt();
      createModule(moduleDefinition, name, dest);
      break;
    }
    case TYPES.template: {
      const { templateType } = await createTemplatePrompt();

      commandTrackingContext.templateType = templateType;
      createTemplate(name, dest, templateType);
      break;
    }
    case TYPES['api-sample']: {
      const filePath = path.join(dest, name);
      if (fs.existsSync(filePath)) {
        const { overwrite } = await overwriteSamplePrompt(filePath);
        if (overwrite) {
          fs.rmdirSync(filePath, { recursive: true });
        } else {
          return;
        }
      }
      const downloadSpinner = ora('Loading available API samples');
      downloadSpinner.start();
      const samplesConfig = await fetchJsonFromRepository(
        PROJECT_REPOSITORIES[assetType],
        'main/samples.json'
      );
      downloadSpinner.stop();
      if (!samplesConfig) {
        logger.error(
          `Currently there are no samples available, please, try again later.`
        );
        return;
      }
      const { sampleType, sampleLanguage } = await createApiSamplePrompt(
        samplesConfig
      );
      if (!sampleType || !sampleLanguage) {
        logger.error(
          `Currently there are no samples available, please, try again later.`
        );
        return;
      }
      logger.info(
        `You've chosen ${sampleType} sample written on ${sampleLanguage} language`
      );
      const created = await createProject(
        filePath,
        assetType,
        sampleType,
        sampleLanguage,
        {
          ...options,
          releaseType: GITHUB_RELEASE_TYPES.REPOSITORY,
        }
      );
      if (created) {
        if (fs.existsSync(`${filePath}/.env.template`)) {
          fs.copySync(`${filePath}/.env.template`, `${filePath}/.env`);
        }
        logger.success(
          `Please, follow ${filePath}/README.md to find out how to run the sample`
        );
      }
      break;
    }
    case TYPES['website-theme']:
      createProject(
        dest,
        assetType,
        PROJECT_REPOSITORIES[assetType],
        'src',
        options
      );
      break;
    case TYPES['app']:
    case TYPES['react-app']:
    case TYPES['vue-app']:
    case TYPES['webpack-serverless']: {
      createProject(
        dest,
        assetType,
        PROJECT_REPOSITORIES[assetType],
        '',
        options
      );
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

  trackCommandUsage('create', commandTrackingContext, getAccountId(options));
};

exports.builder = yargs => {
  yargs.positional('type', {
    describe: 'Type of asset',
    type: 'string',
  });
  yargs.positional('name', {
    describe: 'Name of new asset',
    type: 'string',
  });
  yargs.positional('dest', {
    describe:
      'Destination folder for the new asset, relative to your current working directory. If omitted, this argument will default to your current working directory.',
    type: 'string',
  });

  return yargs;
};
