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
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { logger } = require('@hubspot/cli-lib/logger');
const { uploadProject } = require('@hubspot/cli-lib/api/dfs');
const { validateAccount } = require('../../lib/validation');
const fs = require('fs');
const findup = require('findup-sync');
const { getCwd } = require('../../../cli-lib/path');
const path = require('path');
const archiver = require('archiver');
const tmp = require('tmp');
const { prompt } = require('inquirer');

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

  const { path: projectPath, name } = options;
  const accountId = getAccountId(options);

  // TODO:
  // trackCommandUsage('projects-upload', { projectPath }, accountId);

  const cwd = projectPath ? path.resolve(getCwd(), projectPath) : getCwd();
  const { projects } = await getProjectConfig(cwd);

  if (!projects) {
    return logger.error(
      `No projects found in ${cwd}. Try running 'hs project init' first.`
    );
  }

  const projectsForAccount = projects.filter(p => p.accountId === accountId);

  let currentProject;
  if (name) {
    currentProject = projectsForAccount.find(p => p.name === name);

    if (!currentProject) {
      return logger.error(
        `Project '${name}' does not exist. Try running 'hs project init' first.`
      );
    }
  }

  if (projectsForAccount.length > 1) {
    const projectNamePrompt = await prompt({
      name: 'projectName',
      message: 'Which project would you like to upload?',
      type: 'list',
      choices: projectsForAccount.map(p => p.name),
    });
    console.log('selectedName', projectNamePrompt.projectName);
    currentProject = projectsForAccount.find(
      p => p.name === projectNamePrompt.projectName
    );
  } else {
    currentProject = projectsForAccount[0];
  }

  const tmpFile = tmp.fileSync({ postfix: '.zip' });

  logger.log(`Compressing build files to '${tmpFile.name}'`);

  const output = fs.createWriteStream(tmpFile.name);
  const archive = archiver('zip');

  output.on('close', async function() {
    logger.log(`Project files compressed: ${archive.pointer()} bytes`);

    await uploadProjectFiles(accountId, currentProject.name, tmpFile.name);

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
  console.log(path.resolve(cwd, currentProject.projectDir));

  archive.glob('**/*', {
    cwd: path.resolve(cwd, currentProject.projectDir),
    ignore: ['.*'],
  });
  // archive.directory(path.resolve(cwd, currentProject.projectDir), false);

  archive.finalize();
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: 'Path to a project folder',
    type: 'string',
  });

  yargs.options({
    name: {
      describe: 'Project name',
      type: 'string',
    },
  });

  yargs.example([['$0 project upload myProjectFolder', 'Upload a project']]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
