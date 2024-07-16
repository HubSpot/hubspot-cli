const cmd = require('./helpers/cmd');
const { CONFIG_FILE_NAME } = require('../lib/constants');
const rimraf = require('rimraf');
const { existsSync, readFileSync } = require('fs');
const yaml = require('js-yaml');

describe('hs init', () => {
  const { cli, config } = global;

  beforeAll(() => {
    rimraf.sync(CONFIG_FILE_NAME);
  });

  it('should begin with no config file present', async () => {
    expect(existsSync(CONFIG_FILE_NAME)).toBe(false);
  });

  it('should create a new config file', async () => {
    await cli.execute(
      ['init', `--c="${CONFIG_FILE_NAME}"`],
      [config.personalAccessKey, cmd.ENTER, 'QA', cmd.ENTER]
    );

    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });

  it('should create the correct content within the config file', async () => {
    expect(
      yaml.load(readFileSync(CONFIG_FILE_NAME, 'utf8')).portals[0]
        .personalAccessKey
    ).toEqual(config.personalAccessKey);
  });

  it('should populate the config file with the correct defaultPortal', async () => {
    const config = yaml.load(readFileSync(CONFIG_FILE_NAME, 'utf8'));
    expect(config.defaultPortal).toEqual('QA');
  });
});
