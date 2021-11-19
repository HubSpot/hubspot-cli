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

exports.command = 'upload [path]';
exports.describe = false;

const uploadProjectFiles = async (accountId, projectName, filePath) => {
  const spinnies = new Spinnies({
    succeedColor: 'white',
  });
  const boldProjectName = chalk.bold(projectName);
  const boldAccountId = chalk.bold(accountId);

  spinnies.add('upload', {
    text: i18n(`${i18nKey}.loading.upload.add`, {
      accountId: boldAccountId,
      projectName: boldProjectName,
    }),
  });

  let buildId;

  try {
    const upload = await uploadProject(accountId, projectName, filePath);

    buildId = upload.buildId;

    spinnies.succeed('upload', {
      text: i18n(`${i18nKey}.loading.upload.succeed`, {
        accountId: boldAccountId,
        projectName: boldProjectName,
      }),
    });

    logger.debug(
      `Project "${projectName}" uploaded and build #${buildId} created`
    );
  } catch (err) {
    spinnies.fail('upload', {
      text: i18n(`${i18nKey}.loading.upload.fail`, {
        accountId: boldAccountId,
        projectName: boldProjectName,
      }),
    });

    logApiErrorInstance(
      err,
      new ApiErrorContext({
        accountId,
        projectName,
      })
    );
    process.exit(1);
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
    let exitCode = 0;
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
      subbuildStatuses,
    } = await pollBuildStatus(accountId, projectConfig.name, buildId);

    if (status === 'FAILURE') {
      const failedSubbuilds = subbuildStatuses.filter(
        subbuild => subbuild.status === 'FAILURE'
      );

      logger.log('-'.repeat(50));
      logger.log(
        i18n(`${i18nKey}.logs.buildFailed`, {
          buildErrorCulprit:
            failedSubbuilds.length === 1
              ? failedSubbuilds[0].buildName
              : failedSubbuilds.length + ' components',
          buildId,
        })
      );
      logger.log(i18n(`${i18nKey}.logs.seeErrorsBelow`));
      logger.log('-'.repeat(50));

      failedSubbuilds.forEach(subbuild => {
        logger.log(
          i18n(`${i18nKey}.logs.subbuildFailed`, {
            subbuild: subbuild.buildName,
          })
        );
        logger.error(subbuild.errorMessage);
      });

      exitCode = 1;
    } else if (isAutoDeployEnabled && deployStatusTaskLocator) {
      // TODO - Get "Automatically deploying" to be bold
      logger.log(
        i18n(`${i18nKey}.logs.buildSucceededAutomaticallyDeploying`, {
          accountId,
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
        exitCode = 1;
      }
    } else {
      logger.log('-'.repeat(50));
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
      logger.log('-'.repeat(50));
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
