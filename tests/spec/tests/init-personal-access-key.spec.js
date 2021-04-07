const cmd = require('../helpers/cmd');
const rimraf = require('rimraf');
const { existsSync, readFileSync } = require('fs');
const yaml = require('js-yaml');

describe('hs init using personalAccessKey', () => {
  const { cli, config } = global;

  beforeAll(() => {
    rimraf.sync('hubspot.config.yml');
  });

  it('should begin with no config file present', async () => {
    expect(existsSync('hubspot.config.yml')).toBe(false);
  });

  it('should create a new config file', async () => {
    await cli.execute(
      ['init', '--force'],
      [cmd.ENTER, config.personalAccessKey, cmd.ENTER, 'QA', cmd.ENTER]
    );

    expect(existsSync('hubspot.config.yml')).toBe(true);
  });

  it('should create the correct content within the config file', async () => {
    expect(
      yaml.load(readFileSync('hubspot.config.yml', 'utf8')).portals[0]
        .personalAccessKey
    ).toEqual(config.personalAccessKey);
  });

  it('should populate the config file with the correct defaultPortal', async () => {
    const config = yaml.load(readFileSync('hubspot.config.yml', 'utf8'));
    expect(config.defaultPortal).toEqual('QA');
  });
});
