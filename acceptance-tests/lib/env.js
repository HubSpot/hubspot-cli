const path = require('path');
const dotEnv = require('dotenv');
const { existsSync } = require('fs');
const { DEFAULT_CLI_PATH } = require('./constants');

let dotEnvConfig;

(() => {
  dotEnvConfig = dotEnv.config({ path: path.join(__dirname, '../.env') });
})();

const getTruthyValuesOnly = obj => {
  const truthyValuesObj = {};

  Object.keys(obj).forEach(prop => {
    const truthyValue = obj[prop];
    if (truthyValue) {
      truthyValuesObj[prop] = truthyValue;
    }
  });

  return truthyValuesObj;
};

let argsOverrides = {};

const getEnvValue = envVariable => {
  return (
    (dotEnvConfig.parsed && dotEnvConfig.parsed[envVariable]) ||
    process.env[envVariable]
  );
};

const setArgsOverrides = args => {
  args.portalId && (argsOverrides.portalId = args.portalId);
  args.cliPath && (argsOverrides.cliPath = args.cliPath);
  args.cliNPMVersion && (argsOverrides.cliNPMVersion = args.cliNPMVersion);
  args.personalAccessKey &&
    (argsOverrides.personalAccessKey = args.personalAccessKey);
  argsOverrides.qa = args.qa;
  argsOverrides.debug = args.debug;
  argsOverrides.headless = !!args.headless;
};

const envOverrides = getTruthyValuesOnly({
  portalId: getEnvValue('PORTAL_ID') || getEnvValue('ACCOUNT_ID'),
  cliPath: getEnvValue('CLI_PATH'),
  personalAccessKey: getEnvValue('PERSONAL_ACCESS_KEY'),
  cliNPMVersion: getEnvValue('CLI_NPM_VERSION'),
});

const getTestConfig = () => {
  // Command-line Args > Env vars
  const config = Object.assign({}, envOverrides, argsOverrides);

  if (!config.portalId) {
    throw new Error(
      'accountId must be defined. Either set the ACCOUNT_ID environment variable or use the --accountId flag to pass it in.'
    );
  }

  if (config.cliPath && config.cliNPMVersion) {
    throw new Error(
      'You cannot specify both a cliPath and a cliNPMVersion. Remove one and try again.'
    );
  }

  if (!config.cliPath && !config.cliNPMVersion) {
    const defaultPath = path.join(process.cwd(), DEFAULT_CLI_PATH);

    if (existsSync(defaultPath)) {
      config.cliPath = defaultPath;
    } else {
      throw new Error(
        'cliPath must be defined. Either set the CLI_PATH environment variable or use the --cliPath flag to pass it in.'
      );
    }
  }

  if (!config.personalAccessKey) {
    throw new Error(
      'personalAccessKey must be defined. Either set the PERSONAL_ACCESS_KEY environment variable or use the --personalAccessKey flag to pass it in.'
    );
  }

  if (config.debug) {
    console.log('Config: ', config);
  }

  return config;
};

module.exports = {
  getTestConfig,
  setArgsOverrides,
};
