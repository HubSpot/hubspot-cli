import * as path from 'path';
import * as dotEnv from 'dotenv';
import { existsSync } from 'fs';
import { DEFAULT_CLI_PATH } from './constants.js';
import { TestConfig } from './types';

let dotEnvConfig = dotEnv.config({ path: path.join(__dirname, '../.env') });

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

const getEnvValue = (envVariable: string) => {
  return (
    (dotEnvConfig.parsed && dotEnvConfig.parsed[envVariable]) ||
    process.env[envVariable]
  );
};

const envOverrides: TestConfig = getTruthyValuesOnly({
  portalId: getEnvValue('PORTAL_ID') || getEnvValue('ACCOUNT_ID'),
  cliPath: getEnvValue('CLI_PATH'),
  personalAccessKey: getEnvValue('PERSONAL_ACCESS_KEY'),
  cliVersion: getEnvValue('CLI_VERSION'),
  debug: getEnvValue('DEBUG'),
  qa: getEnvValue('QA'),
}) as TestConfig;

export const getTestConfig = (): TestConfig => {
  // Command-line Args > Env vars
  const config: TestConfig = { ...envOverrides };

  if (!config.portalId) {
    throw new Error(
      'accountId must be defined. Either set the ACCOUNT_ID environment variable or use the --accountId flag to pass it in.'
    );
  }

  if (config.cliPath && config.cliVersion) {
    throw new Error(
      'You cannot specify both a cliPath and a cliVersion. Remove one and try again.'
    );
  }

  if (!config.cliPath && !config.cliVersion) {
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