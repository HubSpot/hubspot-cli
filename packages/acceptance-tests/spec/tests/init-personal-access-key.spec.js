const cmd = require('../helpers/cmd');
const { CONFIG_FILE_PATH } = require('../../lib/constants');
const rimraf = require('rimraf');
const { existsSync, readFileSync } = require('fs');
const yaml = require('js-yaml');

describe('hs init using personalAccessKey', () => {
  const { cli, config } = global;

  beforeAll(() => {
    rimraf.sync(CONFIG_FILE_PATH);
  });

  it('should begin with no config file present', async () => {
    expect(existsSync(CONFIG_FILE_PATH)).toBe(false);
  });

  it('should create a new config file', async () => {
    await cli.execute(
      ['init', `--c="${CONFIG_FILE_PATH}"`],
      [cmd.ENTER, config.personalAccessKey, cmd.ENTER, 'QA', cmd.ENTER]
    );

    expect(existsSync(CONFIG_FILE_PATH)).toBe(true);
  });

  it('should create the correct content within the config file', async () => {
    expect(
      yaml.load(readFileSync(CONFIG_FILE_PATH, 'utf8')).portals[0]
        .personalAccessKey
    ).toEqual(config.personalAccessKey);
  });

  it('should populate the config file with the correct defaultPortal', async () => {
    const config = yaml.load(readFileSync(CONFIG_FILE_PATH, 'utf8'));
    expect(config.defaultPortal).toEqual('QA');
  });
});
