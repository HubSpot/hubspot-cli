const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const tmp = require('tmp');
const Spinnies = require('spinnies');
const {
  addAccountOptions,
  addConfigOptions,
  getAccountId,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { trackCommandUsage } = require('../../lib/usageTracking');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const { uiLine, uiAccountDescription } = require('../../lib/ui');
const { logger } = require('@hubspot/cli-lib/logger');
const { uploadProject } = require('@hubspot/cli-lib/api/dfs');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');
const { loadAndValidateOptions } = require('../../lib/validation');
const {
  getProjectConfig,
  validateProjectConfig,
  pollBuildStatus,
  ensureProjectExists,
  pollDeployStatus,
} = require('../../lib/projects');
const { i18n } = require('@hubspot/cli-lib/lib/lang');

const i18nKey = 'cli.commands.project.subcommands.upload';
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

exports.command = 'upload [path]';
exports.describe = i18n(`${i18nKey}.describe`);

const uploadProjectFiles = async (accountId, projectName, filePath) => {
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });
  const accountIdentifier = uiAccountDescription(accountId);

  spinnies.add('upload', {
    text: i18n(`${i18nKey}.loading.upload.add`, {
      accountIdentifier,
      projectName,
    }),
  });

  let buildId;

  try {
    const upload = await uploadProject(accountId, projectName, filePath);

    buildId = upload.buildId;

    spinnies.succeed('upload', {
      text: i18n(`${i18nKey}.loading.upload.succeed`, {
        accountIdentifier,
        projectName,
      }),
    });

    logger.debug(
      i18n(`${i18nKey}.debug.buildCreated`, {
        buildId,
        projectName,
      })
    );
  } catch (err) {
    spinnies.fail('upload', {
      text: i18n(`${i18nKey}.loading.upload.fail`, {
        accountIdentifier,
        projectName,
      }),
    });

    logApiErrorInstance(
      err,
      new ApiErrorContext({
        accountId,
        projectName,
      })
    );
    process.exit(EXIT_CODES.ERROR);
  }

  return { buildId };
};

exports.handler = async options => {
  await loadAndValidateOptions(options);

  const { forceCreate, path: projectPath } = options;
  const accountId = getAccountId(options);

  trackCommandUsage('project-upload', { projectPath }, accountId);

  const { projectConfig, projectDir } = await getProjectConfig(projectPath);

  validateProjectConfig(projectConfig, projectDir);

  await ensureProjectExists(accountId, projectConfig.name, forceCreate);

  const tempFile = tmp.fileSync({ postfix: '.zip' });

  logger.debug(
    i18n(`${i18nKey}.debug.compressing`, {
      path: tempFile.name,
    })
  );

  const output = fs.createWriteStream(tempFile.name);
  const archive = archiver('zip');

  output.on('close', async function() {
    let exitCode = EXIT_CODES.SUCCESS;
    logger.debug(
      i18n(`${i18nKey}.debug.compressed`, {
        byteCount: archive.pointer(),
      })
    );

    const { buildId } = await uploadProjectFiles(
      accountId,
      projectConfig.name,
      tempFile.name
    );

    const {
      isAutoDeployEnabled,
      deployStatusTaskLocator,
      status,
    } = await pollBuildStatus(accountId, projectConfig.name, buildId);

    if (status === 'FAILURE') {
      exitCode = EXIT_CODES.ERROR;
      return;
    } else if (isAutoDeployEnabled && deployStatusTaskLocator) {
      logger.log(
        i18n(`${i18nKey}.logs.buildSucceededAutomaticallyDeploying`, {
          accountIdentifier: uiAccountDescription(accountId),
          buildId,
        })
      );
      const { status } = await pollDeployStatus(
        accountId,
        projectConfig.name,
        deployStatusTaskLocator.id,
        buildId
      );
      if (status === 'FAILURE') {
        exitCode = EXIT_CODES.ERROR;
      }
    } else {
      uiLine();
      logger.log(
        chalk.bold(
          i18n(`${i18nKey}.logs.buildSucceeded`, {
            buildId,
          })
        )
      );
      logger.log(i18n(`${i18nKey}.logs.readyToGoLive`));
      logger.log(
        i18n(`${i18nKey}.logs.runCommand`, {
          command: chalk.hex('f5c26b')('hs project deploy'),
        })
      );
      uiLine();
    }

    try {
      tempFile.removeCallback();
      logger.debug(
        i18n(`${i18nKey}.debug.cleanedUpTempFile`, {
          path: tempFile.name,
        })
      );
    } catch (e) {
      logger.error(e);
    }

    process.exit(exitCode);
  });

  archive.on('error', function(err) {
    throw err;
  });

  archive.pipe(output);

  archive.directory(
    path.resolve(projectDir, projectConfig.srcDir),
    false,
    file => (shouldIgnoreFile(file.name) ? false : file)
  );

  archive.finalize();
};

exports.builder = yargs => {
  yargs.positional('path', {
    describe: i18n(`${i18nKey}.positionals.path.describe`),
    type: 'string',
  });

  yargs.option('forceCreate', {
    describe: i18n(`${i18nKey}.options.forceCreate.describe`),
    type: 'boolean',
    default: false,
  });

  yargs.example([
    ['$0 project upload myProjectFolder', i18n(`${i18nKey}.examples.default`)],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
