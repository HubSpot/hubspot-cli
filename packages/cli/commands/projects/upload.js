const {
  addAccountOptions,
  addConfigOptions,
  setLogLevel,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const { logDebugInfo } = require('../../lib/debugInfo');
const {
  loadConfig,
  validateConfig,
  checkAndWarnGitInclusion,
} = require('@hubspot/cli-lib');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { uploadProject } = require('@hubspot/cli-lib/api/dfs');
const { validateAccount } = require('../../lib/validation');
const fs = require('fs');
const { getCwd } = require('@hubspot/cli-lib/path');
const path = require('path');
const archiver = require('archiver');
const tmp = require('tmp');
const {
  getProjectConfig,
  validateProjectConfig,
} = require('../../lib/projects');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');

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

const uploadProjectFiles = async (accountId, projectName, filePath) => {
  logger.log(`Uploading project '${projectName}'...`);
  try {
    const upload = await uploadProject(accountId, projectName, filePath);
    logger.log(`Project uploaded and build #${upload.buildId} created`);
  } catch (err) {
    if (err.statusCode === 404) {
      return logger.error(
        `Project '${projectName}' does not exist. Try running 'hs project init' first.`
      );
    }
    logApiErrorInstance(err, {
      context: new ApiErrorContext({
        accountId,
        projectName,
      }),
    });
  }
};

exports.handler = async options => {
  loadAndValidateOptions(options);

  const { path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('projects-upload', { projectPath }, accountId);

  const cwd = projectPath ? path.resolve(getCwd(), projectPath) : getCwd();
  const projectConfig = await getProjectConfig(cwd);

  validateProjectConfig(projectConfig);

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  logger.log(`Compressing build files to '${tempFile.name}'`);

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  output.on('close', async function() {
    logger.log(`Project files compressed: ${archive.pointer()} bytes`);

    await uploadProjectFiles(accountId, projectConfig.name, tempFile.name);

    try {
      tempFile.removeCallback();
      logger.debug(`Cleaned up temporary file ${tempFile.name}`);
    } catch (e) {
      logger.error(e);
    }
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  archive.directory(path.resolve(cwd, projectConfig.srcDir), false, file =>
    shouldIgnoreFile(file.name) ? false : file
  );

  archive.finalize();
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.example([['$0 project upload myProjectFolder', 'Upload a project']]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
