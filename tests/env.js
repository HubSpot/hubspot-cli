const dotEnvConfig = require('dotenv').config();

let localOverrides = {};
let localTestOverrides = {};

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

const envOverrides = {
  ...(process.env.PORTAL_ID && { portalId: process.env.PORTAL_ID }),
  ...(process.env.CLI_PATH && { cliPath: process.env.CLI_PATH }),
  ...(process.env.PERSONAL_ACCESS_KEY && {
    personalAccessKey: process.env.PERSONAL_ACCESS_KEY,
  }),
  ...(process.env.CLIENT_ID && { clientId: process.env.CLIENT_ID }),
  ...(process.env.CLIENT_SECRET && { clientSecret: process.env.CLIENT_SECRET }),
  ...(process.env.REFRESH_TOKEN && { clientSecret: process.env.REFRESH_TOKEN }),
};

const getTestConfig = () => {
  // Test-specific Overrides > Command-line Args > DotEnv Vars > Env vars
  const config = Object.assign(
    {},
    envOverrides,
    dotEnvConfig,
    localOverrides,
    localTestOverrides
  );

  if (!config.portalId)
    throw new Error(
      'portalId must be defined.  Either set the PORTAL_ID environment variable or use the --portal flag to pass it in'
    );
  // TODO - Use 'hs' as default for cliPath?
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
