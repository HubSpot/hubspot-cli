const chokidar = require('chokidar');
const path = require('path');
const { default: PQueue } = require('p-queue');
const { i18n } = require('./lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  isSpecifiedError,
} = require('@hubspot/cli-lib/errorHandlers/apiErrors');
const { handleKeypress } = require('@hubspot/cli-lib/lib/process');
const {
  logApiErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cli-lib/errorHandlers');
const {
  PROJECT_BUILD_TEXT,
  PROJECT_DEPLOY_TEXT,
  ERROR_TYPES,
} = require('@hubspot/cli-lib/lib/constants');
const { isAllowedExtension } = require('@hubspot/cli-lib/path');
const { shouldIgnoreFile } = require('@hubspot/cli-lib/ignoreRules');
const {
  cancelStagedBuild,
  uploadFileToBuild,
  deleteFileFromBuild,
  provisionBuild,
  queueBuild,
} = require('@hubspot/cli-lib/api/dfs');
const SpinniesManager = require('./SpinniesManager');
const DevServerManager = require('./DevServerManager');
const { EXIT_CODES } = require('./enums/exitCodes');
const { pollProjectBuildAndDeploy } = require('./projects');
const { uiAccountDescription, uiLink } = require('./ui');

const i18nKey = 'cli.lib.LocalDevManager';

const BUILD_DEBOUNCE_TIME_LONG = 5000;
const BUILD_DEBOUNCE_TIME_SHORT = 3500;

const WATCH_EVENTS = {
  add: 'add',
  change: 'change',
  unlink: 'unlink',
  unlinkDir: 'unlinkDir',
};

const UPLOAD_PERMISSIONS = {
  always: 'always',
  manual: 'manual',
  never: 'never',
};

class LocalDevManager {
  constructor(options) {
    this.targetAccountId = options.targetAccountId;
    this.projectConfig = options.projectConfig;
    this.projectDir = options.projectDir;
    this.extension = options.extension;
    this.devServerPath = options.devServerPath;
    this.uploadPermission =
      options.uploadPermission || UPLOAD_PERMISSIONS.always;
    this.debug = options.debug || false;

    this.projectSourceDir = path.join(
      this.projectDir,
      this.projectConfig.srcDir
    );
    this.watcher = null;
    this.uploadQueue = null;
    this.standbyChanges = [];
    this.debouncedBuild = null;
    this.currentStagedBuildId = null;

    if (!this.targetAccountId || !this.projectConfig || !this.projectDir) {
      logger.log(i18n(`${i18nKey}.failedToInitialize`));
      process.exit(EXIT_CODES.ERROR);
    }
  }

  async start() {
    SpinniesManager.init();

    this.watcher = chokidar.watch(this.projectSourceDir, {
      ignoreInitial: true,
      ignored: file => shouldIgnoreFile(file),
    });

    this.uploadQueue = new PQueue({ concurrency: 10 });

    if (this.debug) {
      this.uploadQueue.on('error', error => {
        logger.debug(error);
      });
    }

    console.clear();
    SpinniesManager.removeAll();

    logger.log(i18n(`${i18nKey}.header.betaMessage`));
    logger.log();

    this.updateConsoleHeader();

    await this.devServerStart();

    if (!this.devServerPath) {
      this.uploadQueue.start();
      await this.startWatching();
    } else {
      this.uploadPermission = UPLOAD_PERMISSIONS.never;
    }

    this.updateKeypressListeners();

    this.updateConsoleHeader();
  }

  async stop() {
    this.clearConsoleContent();

    SpinniesManager.add('cleanupMessage', {
      text: i18n(`${i18nKey}.exitingStart`),
    });

    await this.stopWatching();
    await this.devServerCleanup();

    let exitCode = EXIT_CODES.SUCCESS;

    if (this.currentStagedBuildId) {
      try {
        await cancelStagedBuild(this.targetAccountId, this.projectConfig.name);
      } catch (err) {
        if (
          !isSpecifiedError(err, {
            subCategory: ERROR_TYPES.BUILD_NOT_IN_PROGRESS,
          })
        ) {
          logApiErrorInstance(
            err,
            new ApiErrorContext({
              accountId: this.targetAccountId,
              projectName: this.projectConfig.name,
            })
          );
          exitCode = EXIT_CODES.ERROR;
        }
      }
    }

    if (exitCode === EXIT_CODES.SUCCESS) {
      SpinniesManager.succeed('cleanupMessage', {
        text: i18n(`${i18nKey}.exitingSucceed`),
      });
    } else {
      SpinniesManager.fail('cleanupMessage', {
        text: i18n(`${i18nKey}.exitingFail`),
      });
    }

    process.exit(exitCode);
  }

  updateConsoleHeader() {
    SpinniesManager.addOrUpdate('devModeRunning', {
      text: i18n(`${i18nKey}.header.running`, {
        accountIdentifier: uiAccountDescription(this.targetAccountId),
        projectName: this.projectConfig.name,
      }),
      isParent: true,
      category: 'header',
    });
    SpinniesManager.addOrUpdate('devModeStatus', {
      text: i18n(`${i18nKey}.header.status.clean`),
      status: 'non-spinnable',
      indent: 1,
      category: 'header',
    });

    const viewText = DevServerManager.initialized
      ? uiLink(
          i18n(`${i18nKey}.header.viewInHubSpotLink`),
          DevServerManager.generateURL(`hs/project`),
          {
            inSpinnies: true,
          }
        )
      : ' ';

    SpinniesManager.addOrUpdate('viewInHubSpotLink', {
      text: viewText,
      status: 'non-spinnable',
      indent: 1,
      category: 'header',
    });
    SpinniesManager.addOrUpdate('spacer-1', {
      text: ' ',
      status: 'non-spinnable',
      category: 'header',
    });
    SpinniesManager.addOrUpdate('quitHelper', {
      text: i18n(`${i18nKey}.header.quitHelper`),
      status: 'non-spinnable',
      indent: 1,
      category: 'header',
    });
    SpinniesManager.addOrUpdate('lineSeparator', {
      text: '-'.repeat(50),
      status: 'non-spinnable',
      noIndent: true,
      category: 'header',
    });
  }

  clearConsoleContent() {
    SpinniesManager.removeAll({ preserveCategory: 'header' });
  }

  updateKeypressListeners() {
    handleKeypress(async key => {
      if ((key.ctrl && key.name === 'c') || key.name === 'q') {
        this.stop();
      } else if (
        (key.name === 'y' || key.name === 'n') &&
        this.uploadPermission === UPLOAD_PERMISSIONS.manual &&
        this.hasAnyUnsupportedStandbyChanges()
      ) {
        SpinniesManager.remove('manualUploadRequired');
        SpinniesManager.remove('manualUploadExplanation1');
        SpinniesManager.remove('manualUploadExplanation2');
        SpinniesManager.remove('manualUploadPrompt');

        if (key.name === 'y') {
          SpinniesManager.add(null, {
            text: i18n(`${i18nKey}.upload.manualUploadConfirmed`),
            status: 'succeed',
            succeedColor: 'white',
            noIndent: true,
          });
          this.updateDevModeStatus('manualUpload');
          await this.createNewStagingBuild();
          this.flushStandbyChanges();
          await this.queueBuild();
        } else if (key.name === 'n') {
          SpinniesManager.add(null, {
            text: i18n(`${i18nKey}.upload.manualUploadSkipped`),
            status: 'fail',
            failColor: 'white',
            noIndent: true,
          });
        }
      }
    });
  }

  logBuildError(buildStatus = {}) {
    const subTasks = buildStatus[PROJECT_BUILD_TEXT.SUBTASK_KEY] || [];
    const failedSubTasks = subTasks.filter(task => task.status === 'FAILURE');

    if (failedSubTasks.length) {
      this.updateDevModeStatus('buildError');

      failedSubTasks.forEach(failedSubTask => {
        SpinniesManager.add(null, {
          text: failedSubTask.errorMessage,
          status: 'fail',
          failColor: 'white',
          indent: 1,
        });
      });
    }
  }

  logDeployError(deployStatus = {}) {
    const subTasks = deployStatus[PROJECT_DEPLOY_TEXT.SUBTASK_KEY] || [];
    const failedSubTasks = subTasks.filter(task => task.status === 'FAILURE');

    if (failedSubTasks.length) {
      this.updateDevModeStatus('deployError');

      failedSubTasks.forEach(failedSubTask => {
        SpinniesManager.add(null, {
          text: failedSubTask.errorMessage,
          status: 'fail',
          failColor: 'white',
          indent: 1,
        });
      });
    }
  }

  updateDevModeStatus(langKey) {
    SpinniesManager.update('devModeStatus', {
      text: i18n(`${i18nKey}.header.status.${langKey}`),
      status: 'non-spinnable',
      noIndent: true,
    });
  }

  async pauseUploadQueue() {
    this.uploadQueue.pause();
    await this.uploadQueue.onIdle();
  }

  hasAnyUnsupportedStandbyChanges() {
    return this.standbyChanges.some(({ supported }) => !supported);
  }

  async createNewStagingBuild() {
    try {
      const { buildId } = await provisionBuild(
        this.targetAccountId,
        this.projectConfig.name
      );
      this.currentStagedBuildId = buildId;
    } catch (err) {
      logger.debug(err);
      if (isSpecifiedError(err, { subCategory: ERROR_TYPES.PROJECT_LOCKED })) {
        await cancelStagedBuild(this.targetAccountId, this.projectConfig.name);
        SpinniesManager.add(null, {
          text: i18n(`${i18nKey}.previousStagingBuildCancelled`),
          status: 'non-spinnable',
        });
      }
      this.stop();
    }
  }

  async startWatching() {
    if (this.uploadPermission === UPLOAD_PERMISSIONS.always) {
      await this.createNewStagingBuild();
    }

    this.watcher.on('add', async filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.add);
    });
    this.watcher.on('change', async filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.change);
    });
    this.watcher.on('unlink', async filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.unlink);
    });
    this.watcher.on('unlinkDir', async filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.unlinkDir);
    });
  }

  async handleWatchEvent(filePath, event) {
    const changeInfo = {
      event,
      filePath,
      remotePath: path.relative(this.projectSourceDir, filePath),
    };

    if (changeInfo.filePath.includes('dist')) {
      return;
    }

    if (this.uploadPermission !== UPLOAD_PERMISSIONS.always) {
      this.handlePreventedUpload(changeInfo);
      return;
    }

    this.addChangeToStandbyQueue({ ...changeInfo, supported: false });

    if (!this.uploadQueue.isPaused) {
      this.flushStandbyChanges();
    }
  }

  handlePreventedUpload(changeInfo) {
    const { remotePath } = changeInfo;

    if (this.uploadPermission === UPLOAD_PERMISSIONS.never) {
      this.updateDevModeStatus('noUploadsAllowed');

      SpinniesManager.add('noUploadsAllowed', {
        text: i18n(`${i18nKey}.upload.noUploadsAllowed`, {
          filePath: remotePath,
        }),
        status: 'fail',
        failColor: 'white',
        noIndent: true,
      });
    } else {
      this.updateDevModeStatus('manualUploadRequired');

      const addedToQueue = this.addChangeToStandbyQueue({
        ...changeInfo,
        supported: false,
      });

      if (addedToQueue) {
        SpinniesManager.add('manualUploadRequired', {
          text: i18n(`${i18nKey}.upload.manualUploadRequired`),
          status: 'fail',
          failColor: 'white',
          noIndent: true,
        });
        SpinniesManager.add('manualUploadExplanation1', {
          text: i18n(`${i18nKey}.upload.manualUploadExplanation1`),
          status: 'non-spinnable',
          indent: 1,
        });
        SpinniesManager.add('manualUploadExplanation2', {
          text: i18n(`${i18nKey}.upload.manualUploadExplanation2`),
          status: 'non-spinnable',
          indent: 1,
        });
        SpinniesManager.add('manualUploadPrompt', {
          text: i18n(`${i18nKey}.upload.manualUploadPrompt`),
          status: 'non-spinnable',
          indent: 1,
        });
      }
    }
  }

  addChangeToStandbyQueue(changeInfo) {
    const { event, filePath } = changeInfo;

    if (event === WATCH_EVENTS.add || event === WATCH_EVENTS.change) {
      if (!isAllowedExtension(filePath, ['jsx', 'tsx'])) {
        SpinniesManager.add(null, {
          text: i18n(`${i18nKey}.upload.extensionNotAllowed`, {
            filePath,
          }),
          status: 'non-spinnable',
        });
        return false;
      }
    }
    if (shouldIgnoreFile(filePath, true)) {
      SpinniesManager.add(null, {
        text: i18n(`${i18nKey}.upload.fileIgnored`, {
          filePath,
        }),
        status: 'non-spinnable',
      });
      return false;
    }

    const existingIndex = this.standbyChanges.findIndex(
      standyChangeInfo => standyChangeInfo.filePath === filePath
    );

    if (existingIndex > -1) {
      // Make sure the most recent event to this file is the one that gets acted on
      this.standbyChanges[existingIndex].event = event;
    } else {
      this.standbyChanges.push(changeInfo);
    }
    return true;
  }

  async sendChanges(changeInfo) {
    const { event, filePath, remotePath } = changeInfo;

    try {
      if (event === WATCH_EVENTS.add || event === WATCH_EVENTS.change) {
        const { name: spinnerName } = SpinniesManager.add(null, {
          text: i18n(`${i18nKey}.upload.uploadingAddChange`, {
            filePath: remotePath,
          }),
          status: 'non-spinnable',
        });
        await uploadFileToBuild(
          this.targetAccountId,
          this.projectConfig.name,
          filePath,
          remotePath
        );
        SpinniesManager.update(spinnerName, {
          text: i18n(`${i18nKey}.upload.uploadedAddChange`, {
            filePath: remotePath,
          }),
          status: 'non-spinnable',
        });
      } else if (
        event === WATCH_EVENTS.unlink ||
        event === WATCH_EVENTS.unlinkDir
      ) {
        const { name: spinnerName } = SpinniesManager.add(null, {
          text: i18n(`${i18nKey}.upload.uploadingRemoveChange`, {
            filePath: remotePath,
          }),
          status: 'non-spinnable',
        });
        await deleteFileFromBuild(
          this.targetAccountId,
          this.projectConfig.name,
          remotePath
        );
        SpinniesManager.update(spinnerName, {
          text: i18n(`${i18nKey}.upload.uploadedRemoveChange`, {
            filePath: remotePath,
          }),
          status: 'non-spinnable',
        });
      }
    } catch (err) {
      logger.debug(err);
    }
  }

  debounceQueueBuild(changeInfo) {
    const { event } = changeInfo;

    if (this.uploadPermission === UPLOAD_PERMISSIONS.always) {
      this.updateDevModeStatus('uploadPending');
    }

    if (this.debouncedBuild) {
      clearTimeout(this.debouncedBuild);
    }

    const debounceWaitTime =
      event === WATCH_EVENTS.add
        ? BUILD_DEBOUNCE_TIME_LONG
        : BUILD_DEBOUNCE_TIME_SHORT;

    this.debouncedBuild = setTimeout(
      this.queueBuild.bind(this),
      debounceWaitTime
    );
  }

  async queueBuild() {
    SpinniesManager.add(null, { text: ' ', status: 'non-spinnable' });

    const { name: spinnerName } = SpinniesManager.add(null, {
      text: i18n(`${i18nKey}.upload.uploadingChanges`, {
        accountIdentifier: uiAccountDescription(this.targetAccountId),
        buildId: this.currentStagedBuildId,
      }),
      noIndent: true,
    });

    await this.pauseUploadQueue();

    let queueBuildError;

    try {
      await queueBuild(this.targetAccountId, this.projectConfig.name);
    } catch (err) {
      queueBuildError = err;
    }

    if (queueBuildError) {
      this.updateDevModeStatus('buildError');

      logger.debug(queueBuildError);

      SpinniesManager.fail(spinnerName, {
        text: i18n(`${i18nKey}.upload.uploadedChangesFailed`, {
          accountIdentifier: uiAccountDescription(this.targetAccountId),
          buildId: this.currentStagedBuildId,
        }),
        failColor: 'white',
        noIndent: true,
      });

      if (
        isSpecifiedError(queueBuildError, {
          subCategory: ERROR_TYPES.MISSING_PROJECT_PROVISION,
        })
      ) {
        SpinniesManager.add(null, {
          text: i18n(`${i18nKey}.cancelledFromUI`),
          status: 'non-spinnable',
          indent: 1,
        });
        this.stop();
      } else if (
        queueBuildError &&
        queueBuildError.error &&
        queueBuildError.error.message
      ) {
        SpinniesManager.add(null, {
          text: queueBuildError.error.message,
          status: 'non-spinnable',
          indent: 1,
        });
      }
    } else {
      const result = await pollProjectBuildAndDeploy(
        this.targetAccountId,
        this.projectConfig,
        null,
        this.currentStagedBuildId,
        true
      );

      if (result.succeeded) {
        this.updateDevModeStatus('clean');

        SpinniesManager.succeed(spinnerName, {
          text: i18n(`${i18nKey}.upload.uploadedChangesSucceeded`, {
            accountIdentifier: uiAccountDescription(this.targetAccountId),
            buildId: result.buildId,
          }),
          succeedColor: 'white',
          noIndent: true,
        });
      } else {
        SpinniesManager.fail(spinnerName, {
          text: i18n(`${i18nKey}.upload.uploadedChangesFailed`, {
            accountIdentifier: uiAccountDescription(this.targetAccountId),
            buildId: result.buildId,
          }),
          failColor: 'white',
          noIndent: true,
        });

        if (result.buildResult.status === 'FAILURE') {
          this.logBuildError(result.buildResult);
        } else if (result.deployResult.status === 'FAILURE') {
          this.logDeployError(result.deployResult);
        }
      }
    }

    SpinniesManager.removeAll({ targetCategory: 'projectPollStatus' });

    if (
      !queueBuildError &&
      this.uploadPermission === UPLOAD_PERMISSIONS.always
    ) {
      await this.createNewStagingBuild();
    }

    this.uploadQueue.start();

    if (this.hasAnyUnsupportedStandbyChanges()) {
      this.flushStandbyChanges();
    }
  }

  flushStandbyChanges() {
    if (this.standbyChanges.length) {
      this.uploadQueue.addAll(
        this.standbyChanges.map(changeInfo => {
          return async () => {
            if (
              this.uploadPermission === UPLOAD_PERMISSIONS.always &&
              !this.uploadQueue.isPaused
            ) {
              this.debounceQueueBuild(changeInfo);
            }
            await this.sendChanges(changeInfo);
          };
        })
      );
      this.standbyChanges = [];
    }
  }

  async stopWatching() {
    await this.watcher.close();
  }

  handleServerLog(serverKey, ...args) {
    SpinniesManager.add(null, {
      text: `${args.join('')}`,
      status: 'non-spinnable',
    });
  }

  async devServerStart() {
    try {
      if (this.devServerPath) {
        DevServerManager.setServer('uie', this.devServerPath);
      }
      await DevServerManager.start({
        accountId: this.targetAccountId,
        debug: this.debug,
        extension: this.extension,
        spinniesLogger: this.handleServerLog,
        projectConfig: this.projectConfig,
        projectSourceDir: this.projectSourceDir,
      });
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      SpinniesManager.add(null, {
        text: i18n(`${i18nKey}.devServer.startError`),
        status: 'non-spinnable',
      });
    }
  }

  async devServerCleanup() {
    try {
      await DevServerManager.cleanup();
    } catch (e) {
      if (this.debug) {
        logger.error(e);
      }
      SpinniesManager.add(null, {
        text: i18n(`${i18nKey}.devServer.cleanupError`),
        status: 'non-spinnable',
      });
    }
  }
}

module.exports = { LocalDevManager, UPLOAD_PERMISSIONS };
