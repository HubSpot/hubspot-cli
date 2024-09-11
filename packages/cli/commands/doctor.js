const pkg = require('../package.json');
const { getProjectConfig } = require('../lib/projects');
const { getAccessToken } = require('@hubspot/local-dev-lib/personalAccessKey');
const { trackCommandUsage } = require('../lib/usageTracking');
const { getAccountConfig } = require('@hubspot/local-dev-lib/config');
const { walk } = require('@hubspot/local-dev-lib/fs');
const path = require('path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const SpinniesManager = require('../lib/ui/SpinniesManager');
const fs = require('fs');
const DoctorManager = require('../lib/DoctorManager');

// const i18nKey = 'commands.doctor';
exports.command = 'doctor';
exports.describe = 'The doctor is in';

exports.handler = async ({ file }) => {
  const doctorManager = new DoctorManager();
  try {
    trackCommandUsage('doctor', null, doctorManager.accountId);
  } catch (e) {
    logger.debug(e);
  }

  SpinniesManager.init();
  SpinniesManager.add('loadingProjectDetails', {
    text: 'Loading project details',
  });

  let projectConfig;
  let projectDetails;
  try {
    projectConfig = await getProjectConfig();
    projectDetails = await doctorManager.fetchProjectDetails(
      doctorManager.accountId,
      projectConfig
    );
  } catch (e) {
    logger.debug(e);
  }

  SpinniesManager.succeed('loadingProjectDetails', {
    text: 'Project details loaded',
  });

  const { env, authType, personalAccessKey, accountType } = getAccountConfig(
    doctorManager.accountId
  );

  let accessToken = {};
  try {
    accessToken = await getAccessToken(
      personalAccessKey,
      env,
      doctorManager.accountId
    );
  } catch (e) {
    logger.debug(e);
  }

  let files = [];
  try {
    files = (await walk(projectConfig.projectDir))
      .filter(doctorManager.shouldIncludeFile)
      .map(filename => path.relative(projectConfig.projectDir, filename));
  } catch (e) {
    logger.debug(e);
  }

  const {
    platform,
    arch,
    versions: { node },
    mainModule: { path: modulePath },
  } = process;

  const output = {
    platform,
    arch,
    path: modulePath,
    versions: {
      '@hubspot/cli': pkg.version,
      node,
      npm: doctorManager.getNpmVersion(),
    },
    account: {
      accountId: doctorManager.accountId,
      accountType,
      authType,
      name: accessToken.hubName,
      scopeGroups: accessToken?.scopeGroups,
      enabledFeatures: accessToken?.enabledFeatures,
    },
    project: {
      config:
        projectConfig && projectConfig.projectConfig
          ? projectConfig
          : undefined,
      details: projectDetails,
    },
    packageFiles: files.filter(file => {
      return path.parse(file).base === 'package.json';
    }),
    packageLockFiles: files.filter(file => {
      return path.parse(file).base === 'package-lock.json';
    }),
    envFiles: files.filter(file => file.endsWith('.env')),
    jsonFiles: files.filter(file => path.extname(file) === '.json'),
    files,
  };

  const stringifiedOutput = JSON.stringify(output, null, 4);

  if (file) {
    try {
      SpinniesManager.add('writingToFile', {
        text: `Writing output to ${file}`,
      });
      fs.writeFileSync(file, JSON.stringify(output, null, 4));
      SpinniesManager.succeed('writingToFile', {
        text: `Output written to ${file}`,
      });
    } catch (e) {
      SpinniesManager.fail('writingToFile', {
        text: 'Unable to write to file',
      });
    }
  } else {
    console.log(stringifiedOutput);
  }
};

exports.builder = yargs =>
  yargs.option({
    file: {
      describe: 'Where to write the output',
      type: 'string',
    },
  });
