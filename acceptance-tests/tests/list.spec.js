const { withAuth } = require('./helpers/auth');
const { CONFIG_FILE_NAME } = require('../lib/constants');

describe('hs list', () => {
  const { cli } = global;

  beforeAll(withAuth);

  it('should print the correct output', async () => {
    let val = await cli.execute(['list', `--c="${CONFIG_FILE_NAME}"`]);
    expect(val).toContain('CLI_TEST_TEMPLATE.html');
  }, 20000);
});
