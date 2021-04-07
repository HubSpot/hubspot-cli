const dotEnvConfig = require('dotenv').config() || {};

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

let localOverrides = {};
let localTestOverrides = {};

const getEnvValue = envVariable => {
  return (
    (dotEnvConfig.parsed && dotEnvConfig.parsed[envVariable]) ||
    process.env[envVariable]
  );
};

const setLocalTestOverrides = (overrides = {}) => {
  localOverrides = { localOverrides, ...overrides };
};

const setArgsOverrides = args => {
  args.portalId && (localOverrides.portalId = args.portalId);
  args.cliPath && (localOverrides.cliPath = args.cliPath);
  args.personalAccessKey &&
    (localOverrides.personalAccessKey = args.personalAccessKey);
  args.clientId && (localOverrides.clientId = args.clientId);
  args.clientSecret && (localOverrides.clientSecret = args.clientSecret);
  args.refreshToken && (localOverrides.refreshToken = args.refreshToken);
  localOverrides.qa = args.qa;
  localOverrides.debug = args.debug;
};

const envOverrides = getTruthyValuesOnly({
  portalId: getEnvValue('PORTAL_ID'),
  cliPath: getEnvValue('CLI_PATH'),
  personalAccessKey: getEnvValue('PERSONAL_ACCESS_KEY'),
  clientId: getEnvValue('CLIENT_ID'),
  clientSecret: getEnvValue('CLIENT_SECRET'),
  refreshToken: getEnvValue('REFRESH_TOKEN'),
});

const getTestConfig = () => {
  // Test-specific Overrides > Command-line Args > Env vars
  const config = Object.assign(
    {},
    envOverrides,
    localOverrides,
    localTestOverrides
  );

  if (!config.portalId)
    throw new Error(
      'portalId must be defined.  Either set the PORTAL_ID environment variable or use the --portal flag to pass it in'
    );

  if (!config.cliPath)
    throw new Error(
      'cliPath must be defined.  Either set the CLI_PATH environment variable or use the --cliPath flag to pass it in'
    );

  if (
    !config.personalAccessKey &&
    !(config.clientId && config.clientSecret && config.refreshToken)
  )
    throw new Error(
      'no valid auth combination was found. Either set the PERSONAL_ACCESS_KEY or CLIENT_ID/CLIENT_SECRET/REFRESH_TOKEN environment variables or use the --personalAccessKey or --clientId, --clientSecret, and --refreshToken flags to pass it in'
    );

  return config;
};

module.exports = {
  getTestConfig,
  setArgsOverrides,
  setLocalTestOverrides,
};
