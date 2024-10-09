import * as path from 'path';
import * as dotEnv from 'dotenv';
import { existsSync } from 'fs';
import { TestConfig } from './types';

const dotEnvConfig = dotEnv.config({ path: path.join(__dirname, '../.env') });

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
  personalAccessKey: getEnvValue('PERSONAL_ACCESS_KEY'),
  useInstalled: getEnvValue('USE_INSTALLED'),
  debug: getEnvValue('DEBUG'),
  qa: getEnvValue('QA'),
  githubToken: getEnvValue('GITHUB_TOKEN'),
}) as TestConfig;

export const getTestConfig = (): TestConfig => {
  // Command-line Args > Env vars
  const config: TestConfig = { ...envOverrides };

  if (!config.portalId) {
    throw new Error(
      'accountId must be defined. Either set the ACCOUNT_ID environment variable or use the --accountId flag to pass it in.'
    );
  }

  if (!config.useInstalled) {
    const defaultPath = path.join(process.cwd(), '../packages/cli/bin/hs');

    if (existsSync(defaultPath)) {
      config.cliPath = defaultPath;
    } else {
      throw new Error('Unable to locate the CLI executable to run');
    }
  }

  if (!config.personalAccessKey) {
    throw new Error(
      'personalAccessKey must be defined. Either set the PERSONAL_ACCESS_KEY environment variable or use the --personalAccessKey flag to pass it in.'
    );
  }

  return config;
};
