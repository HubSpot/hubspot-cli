const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
// const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
// const {
//   logApiErrorInstance,
//   ApiErrorContext,
// } = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { uploadProject } = require('@hubspot/cli-lib/api/dfs');
const { validateAccount } = require('../../lib/validation');
const fs = require('fs');
const findup = require('findup-sync');
const { getCwd } = require('../../../cli-lib/path');
const path = require('path');
const archiver = require('archiver');
const tmp = require('tmp');

const loadAndValidateOptions = async options => {
  setLogLevel(options);
  logDebugInfo(options);
  const { config: configPath } = options;
  loadConfig(configPath, options);
  checkAndWarnGitInclusion();

  if (!(validateConfig() && (await validateAccount(options)))) {
    process.exit(1);
  }
};

exports.command = 'upload [path]';
exports.describe = false;

const getProjectConfig = p => {
  const projectDirectory = findup('hsproject.json', {
    cwd: p,
    nocase: true,
  });

  if (!projectDirectory) {
    return {};
  }
  try {
    const projectConfig = fs.readFileSync(projectDirectory);
    return JSON.parse(projectConfig);
  } catch (e) {
    logger.error('Could not read from project config');
  }
};

const uploadProjectFiles = async (accountId, projectName, filePath) => {
  logger.log('Uploading project...');
  try {
    const upload = await uploadProject(accountId, projectName, filePath);
    logger.log(`Project uploaded and build #${upload.buildId} created`);
  } catch (err) {
    logger.error(err);
  }
};

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath } = options;
  const accountId = getAccountId(options);

  // TODO:
  // trackCommandUsage('projects-upload', { projectPath }, accountId);

  const cwd = path ? path.resolve(getCwd(), projectPath) : getCwd();
  const { name: projectName } = await getProjectConfig(cwd);

  if (!projectName) {
    logger.error('Could not find project name in project config');
    return;
  }

  const tmpFile = tmp.fileSync({ postfix: '.zip' });

  logger.log(`Compressing build files to '${tmpFile.name}'`);

  const output = fs.createWriteStream(tmpFile.name);
  const archive = archiver('zip');

  output.on('close', async function() {
    logger.log(`Project files compressed: ${archive.pointer()} bytes`);

    await uploadProjectFiles(accountId, projectName, tmpFile.name);

    try {
      tmpFile.removeCallback();
      logger.debug(`Cleaned up temporary file ${tmpFile.name}`);
    } catch (e) {
      logger.error(e);
    }
  });
  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  archive.directory(cwd, false);

  archive.finalize();
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.example([['$0 projects upload myProjectFolder', 'Upload a project']]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
