const path = require('path');
const dotEnv = require('dotenv');
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
      'portalId must be defined.  Either set the PORTAL_ID environment variable or use the --portal flag to pass it in.'
    );

  if (!config.cliPath)
    throw new Error(
      'cliPath must be defined.  Either set the CLI_PATH environment variable or use the --cliPath flag to pass it in.'
    );

  if (!config.personalAccessKey)
    throw new Error(
      'No valid auth for personalAccessKey was found. Set the PERSONAL_ACCESS_KEY environment variable or use the --personalAccessKey flag to pass it in.'
    );

  if (!(config.clientId && config.clientSecret && config.refreshToken))
    throw new Error(
      'No valid auth combination for oauth2 was found. Set the CLIENT_ID, CLIENT_SECRET, and REFRESH_TOKEN environment variables or use the --clientId, --clientSecret, and --refreshToken flags to pass them in.'
    );

  return config;
};

module.exports = {
  getTestConfig,
  setArgsOverrides,
  setLocalTestOverrides,
};
