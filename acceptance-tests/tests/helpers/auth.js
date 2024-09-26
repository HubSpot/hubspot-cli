const yaml = require('js-yaml');
const rimraf = require('rimraf');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const cmd = require('./cmd');
const { CONFIG_FILE_NAME } = require('../../lib/constants');

let PARSED_CONFIG_YAML;

async function initializeAuth() {
  try {
    await global.cli.execute(
      ['init', `--c="${CONFIG_FILE_NAME}"`],
      [cmd.ENTER, global.config.personalAccessKey, cmd.ENTER, cmd.ENTER]
    );

    PARSED_CONFIG_YAML = yaml.load(readFileSync(CONFIG_FILE_NAME, 'utf8'));

    rimraf.sync(CONFIG_FILE_NAME);
  } catch (e) {
    throw new Error('Failed to initalize CLI config & authentication');
  }
}

function withAuth() {
  if (existsSync(CONFIG_FILE_NAME)) {
    rimraf.sync(CONFIG_FILE_NAME);
  }

  if (!PARSED_CONFIG_YAML) {
    throw new Error('Unable to write config file.');
  } else {
    writeFileSync(
      CONFIG_FILE_NAME,
      yaml.dump(JSON.parse(JSON.stringify(PARSED_CONFIG_YAML, null, 2)))
    );
  }
}

function getParsedConfig() {
  const temp = yaml.load(readFileSync(CONFIG_FILE_NAME, 'utf8'));
  return JSON.parse(JSON.stringify(temp, null, 2));
}

module.exports = {
  getParsedConfig,
  initializeAuth,
  withAuth,
};
