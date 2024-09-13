const { exec: execAsync } = require('child_process');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { fetchProject } = require('@hubspot/local-dev-lib/api/projects');
const { getAccountId } = require('./commonOpts');
const { getProjectConfig } = require('./projects');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { getAccessToken } = require('@hubspot/local-dev-lib/personalAccessKey');
const pkg = require('../package.json');
const { walk } = require('@hubspot/local-dev-lib/fs');
const SpinniesManager = require('./ui/SpinniesManager');
const {
  isGloballyInstalled,
  packagesNeedInstalled,
} = require('./dependencyManagement');
const util = require('util');
const fs = require('fs');
const path = require('path');

class Doctor {
  constructor() {
    SpinniesManager.init();
    this.accountId = getAccountId();
    const accountConfig = getAccountConfig(this.accountId);
    this.env = accountConfig?.env;
    this.authType = accountConfig?.authType;
    this.accountType = accountConfig?.accountType;
    this.personalAccessKey = accountConfig?.personalAccessKey;
  }

  async diagnose() {
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
      ...this.checkIfNpmInstallRequired(),
      ...this.validateProjectJsonFiles(),
    ]);

    return this.output;
  }

  async checkIfNodeIsInstalled() {
    try {
      SpinniesManager.add('checkingNodeInstalled', {
        text: 'Checking if node is installed',
      });
      const isNodeInstalled = await isGloballyInstalled('node');
      if (isNodeInstalled) {
        SpinniesManager.succeed('checkingNodeInstalled', {
          text: 'node is installed',
        });
        return;
      }
    } catch (e) {
      logger.debug(e);
    }
    SpinniesManager.fail('checkingNodeInstalled', {
      text: 'node may not be installed',
    });
  }

  async checkIfNpmIsInstalled() {
    try {
      SpinniesManager.add('checkingNpmInstalled', {
        text: 'Checking if node is installed',
      });
      const isNpmInstalled = await isGloballyInstalled('npm');
      if (isNpmInstalled) {
        SpinniesManager.succeed('checkingNpmInstalled', {
          text: 'npm is installed',
        });
        return;
      }
    } catch (e) {
      logger.debug(e);
    }
    SpinniesManager.fail('checkingNpmInstalled', {
      text: 'npm may not be installed',
    });
  }

  checkIfNpmInstallRequired() {
    const checks = [];
    for (const packageFile of this.output?.packageFiles || []) {
      const packageDirName = path.dirname(packageFile);
      SpinniesManager.add(`checkingIfNpmInstallRequired-${packageDirName}`, {
        text: `Checking if npm is required in ${packageFile}`,
      });
      checks.push(
        (async () => {
          try {
            const needsInstall = await packagesNeedInstalled(
              path.join(this.projectConfig.projectDir, packageDirName)
            );
            if (needsInstall) {
              SpinniesManager.fail(
                `checkingIfNpmInstallRequired-${packageDirName}`,
                {
                  text: `You need to run npm install in ${packageDirName}`,
                }
              );
              return;
            }
            SpinniesManager.succeed(
              `checkingIfNpmInstallRequired-${packageDirName}`,
              {
                text: `Dependencies are up to date in ${packageDirName}`,
              }
            );
          } catch (e) {
            if (!(await this.isValidJsonFile(packageFile))) {
              return SpinniesManager.fail(
                `checkingIfNpmInstallRequired-${packageDirName}`,
                {
                  text: `The following is not a valid json file: ${packageFile}`,
                }
              );
            }
            SpinniesManager.fail(
              `checkingIfNpmInstallRequired-${packageDirName}`,
              {
                text: `Unable to determine if dependencies are installed in ${packageDirName}`,
              }
            );
            logger.debug(e);
          }
        })()
      );
    }
    return checks;
  }

  async getNpmVersion() {
    const exec = util.promisify(execAsync);
    try {
      const { stdout } = await exec('npm --version');
      return stdout.toString().trim();
    } catch (e) {
      logger.debug(e);
      return null;
    }
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
        .filter(file => !path.dirname(file).includes('node_modules'))
        .map(filename =>
          path.relative(this.projectConfig?.projectDir, filename)
        );
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
          return path.parse(file).base === 'package.json';
        }) || [],
      configFiles:
        this.files?.filter(file => {
          return [
            'serverless.json',
            'hsproject.json',
            'app.json',
            'public-app.json',
          ].includes(path.parse(file).base);
        }) || [],
      packageLockFiles:
        this.files?.filter(file => {
          return path.parse(file).base === 'package-lock.json';
        }) || [],
      envFiles: this.files?.filter(file => file.endsWith('.env')) || [],
      jsonFiles:
        this.files?.filter(file => path.extname(file) === '.json') || [],
      files: this.files || [],
    };
    return this.output;
  }

  async isValidJsonFile(filename) {
    const readFile = util.promisify(fs.readFile);
    try {
      const fileContents = await readFile(filename);
      JSON.parse(fileContents.toString());
    } catch (e) {
      return false;
    }
    return true;
  }

  validateProjectJsonFiles() {
    const checks = [];
    for (const jsonFile of this.output?.configFiles || []) {
      checks.push(
        (async () => {
          try {
            SpinniesManager.add(`checkingJsonValid-${jsonFile}`, {
              text: `Checking if ${jsonFile} is valid JSON`,
            });

            if (
              !(await this.isValidJsonFile(
                path.join(this.projectConfig.projectDir, jsonFile)
              ))
            ) {
              return SpinniesManager.fail(`checkingJsonValid-${jsonFile}`, {
                text: `${jsonFile} is not a valid JSON file`,
              });
            }

            SpinniesManager.succeed(`checkingJsonValid-${jsonFile}`, {
              text: `${jsonFile} is a valid JSON file`,
            });
          } catch (e) {
            logger.debug(e);
            return SpinniesManager.fail(`checkingJsonValid-${jsonFile}`, {
              text: `${jsonFile} is not a valid JSON file`,
            });
          }
        })()
      );
    }
    return checks;
  }
}

module.exports = Doctor;
