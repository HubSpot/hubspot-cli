const { exec: execAsync } = require('child_process');
const { dirname, extname, relative, parse, join, sep } = require('path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { fetchProject } = require('@hubspot/local-dev-lib/api/projects');
const { getAccountId } = require('./commonOpts');
const { getProjectConfig } = require('./projects');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { getAccessToken } = require('@hubspot/local-dev-lib/personalAccessKey');
const pkg = require('../package.json');
const { walk } = require('@hubspot/local-dev-lib/fs');
const SpinniesManager = require('./ui/SpinniesManager');
const { isGloballyInstalled } = require('./dependencyManagement');
const util = require('util');

class Doctor {
  ignoredDirs = ['node_modules'];

  constructor() {
    this.accountId = getAccountId();
    const accountConfig = getAccountConfig(this.accountId);
    this.env = accountConfig?.env;
    this.authType = accountConfig?.authType;
    this.accountType = accountConfig?.accountType;
    this.personalAccessKey = accountConfig?.personalAccessKey;
  }

  async diagnose() {
    SpinniesManager.init();

    SpinniesManager.add('loadingProjectDetails', {
      text: 'Loading project details',
    });

    this.projectConfig = await getProjectConfig();
    if (!this.projectConfig?.projectConfig) {
      SpinniesManager.fail('loadingProjectDetails', {
        text: 'Not running within a project',
      });
    } else {
      await this.fetchProjectDetails();
      await this.getAccessToken();
      await this.loadProjectFiles();
      SpinniesManager.succeed('loadingProjectDetails', {
        text: 'Project details loaded',
      });
    }

    await this.generateOutput();

    await Promise.all([
      this.checkIfNodeIsInstalled(),
      this.checkIfNpmIsInstalled(),
      this.checkIfNpmInstallRequired(),
    ]);

    return await this.generateOutput();
  }

  async checkIfNodeIsInstalled() {
    try {
      SpinniesManager.add('checkingNodeInstalled', {
        text: 'Checking if node is installed',
      });
      const isNodeInstalled = await isGloballyInstalled('node');
      if (isNodeInstalled) {
        SpinniesManager.succeed('checkingNodeInstalled', {
          text: '`node` is installed',
        });
        return;
      }
    } catch (e) {
      logger.debug(e);
    }
    SpinniesManager.fail('checkingNodeInstalled', {
      text: '`node` may not be installed',
    });
  }

  async checkIfNpmIsInstalled() {
    try {
      SpinniesManager.add('checkingNpmInstalled', {
        text: 'Checking if node is installed',
      });
      const isNodeInstalled = await isGloballyInstalled('npm');
      if (isNodeInstalled) {
        SpinniesManager.succeed('checkingNpmInstalled', {
          text: '`npm` is installed',
        });
        return;
      }
    } catch (e) {
      logger.debug(e);
    }
    SpinniesManager.fail('checkingNpmInstalled', {
      text: '`npm` may not be installed',
    });
  }

  async checkIfNpmInstallRequired() {
    const checks = [];
    const exec = util.promisify(execAsync);
    console.log(this.output.packageFiles);
    for (const packageFile of this.output?.packageFiles) {
      SpinniesManager.add(`checkingIfNpmInstallRequired-${packageFile}`, {
        text: `Checking if npm is required in ${packageFile}`,
      });
      checks.push(
        (async () => {
          try {
            // TODO: Fix the prefix
            const result = await exec(
              `npm install --dry-run --prefix=${dirname(packageFile)}`
            );
            console.log(result);
            SpinniesManager.succeed(
              `checkingIfNpmInstallRequired-${packageFile}`,
              {
                text: `npm installed in directory ${dirname(packageFile)}`,
              }
            );
          } catch (e) {
            logger.error(e);
            SpinniesManager.fail(
              `checkingIfNpmInstallRequired-${packageFile}`,
              {
                text: `Node may not be installed, ${e.message}`,
              }
            );
            logger.debug(e);
          }
        })()
      );
    }
  }

  async getNpmVersion() {
    const exec = util.promisify(execAsync);
    try {
      return (await exec('npm --version')).toString().trim();
    } catch (e) {
      logger.debug(e);
      return null;
    }
  }

  shouldIncludeFile(file) {
    try {
      for (const ignoredDir of this.ignoredDirs) {
        if (dirname(file).includes(join(sep, ignoredDir))) {
          return false;
        }
      }
    } catch (e) {
      logger.debug(e);
    }
    return true;
  }

  async fetchProjectDetails() {
    try {
      this.projectDetails = await fetchProject(
        this.accountId,
        this.projectConfig?.projectConfig?.name
      );
      delete this.projectDetails?.deployedBuild;
      delete this.projectDetails?.latestBuild;
      delete this.projectDetails?.portalId;
    } catch (e) {
      logger.debug(e);
    }
  }

  async getAccessToken() {
    try {
      this.accessToken = await getAccessToken(
        this.personalAccessKey,
        this.env,
        this.accountId
      );
    } catch (e) {
      logger.debug(e);
    }
  }

  async loadProjectFiles() {
    try {
      this.files = (await walk(this.projectConfig?.projectDir))
        .filter(this.shouldIncludeFile)
        .map(filename => relative(this.projectConfig?.projectDir, filename));
    } catch (e) {
      logger.debug(e);
    }
  }

  async generateOutput() {
    const {
      platform,
      arch,
      versions: { node },
      mainModule: { path: modulePath },
    } = process;

    this.output = {
      platform,
      arch,
      path: modulePath,
      versions: {
        '@hubspot/cli': pkg.version,
        node,
        npm: await this.getNpmVersion(),
      },
      account: {
        accountId: this.accountId,
        accountType: this.accountType,
        authType: this.authType,
        name: this.accessToken?.hubName,
        scopeGroups: this.accessToken?.scopeGroups,
        enabledFeatures: this.accessToken?.enabledFeatures,
      },
      project: {
        config:
          this.projectConfig && this.projectConfig.projectConfig
            ? this.projectConfig
            : undefined,
        details: this.projectDetails,
      },
      packageFiles:
        this.files?.filter(file => {
          return parse(file).base === 'package.json';
        }) || [],
      packageLockFiles:
        this.files?.filter(file => {
          return parse(file).base === 'package-lock.json';
        }) || [],
      envFiles: this.files?.filter(file => file.endsWith('.env')) || [],
      jsonFiles: this.files?.filter(file => extname(file) === '.json') || [],
      files: this.files || [],
    };
    return this.output;
  }
}

module.exports = Doctor;
