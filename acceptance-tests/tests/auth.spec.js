const { existsSync } = require('fs');
const cmd = require('./helpers/cmd');
const { CONFIG_FILE_NAME } = require('../lib/constants');
const { withAuth } = require('./helpers/auth');

describe('hs auth', () => {
  const { cli, config } = global;

  beforeAll(withAuth);

  it('should begin with a config file present', async () => {
    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });

  it('should update the tokens for the existing configured account', async () => {
    await cli.execute(
      ['auth', `--c="${CONFIG_FILE_NAME}"`],
      [cmd.ENTER, config.personalAccessKey, cmd.ENTER]
    );

    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });
});
