const path = require('node:path');
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
  args.githubToken && (localOverrides.githubToken = args.githubToken);
  localOverrides.qa = args.qa;
  localOverrides.debug = args.debug;
  localOverrides.headless = !!args.headless;
};

const envOverrides = getTruthyValuesOnly({
  portalId: getEnvValue('PORTAL_ID') || getEnvValue('ACCOUNT_ID'),
  cliPath: getEnvValue('CLI_PATH'),
  personalAccessKey: getEnvValue('PERSONAL_ACCESS_KEY'),
  githubToken: getEnvValue('GITHUB_TOKEN'),
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
      'accountId must be defined.  Either set the ACCOUNT_ID environment variable, or use the --accountId flag to pass it in.'
    );

  if (!config.cliPath)
    throw new Error(
      'cliPath must be defined.  Either set the CLI_PATH environment variable or use the --cliPath flag to pass it in.'
    );

  if (!config.personalAccessKey)
    throw new Error(
      'No valid auth for personalAccessKey was found. Set the PERSONAL_ACCESS_KEY environment variable or use the --personalAccessKey flag to pass it in.'
    );

  if (!config.githubToken)
    throw new Error(
      'githubToken must be defined.  Either set the GITHUB_TOKEN environment variable, or use the --githubToken flag to pass it in.'
    );

  return config;
};

module.exports = {
  getTestConfig,
  setArgsOverrides,
  setLocalTestOverrides,
};
