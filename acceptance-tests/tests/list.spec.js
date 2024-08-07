const { CONFIG_FILE_NAME } = require('../lib/constants');

describe('hs list', () => {
  const { cli } = global;

  it('should print the correct output', async () => {
    let val = await cli.execute(['list', `--c="${CONFIG_FILE_NAME}"`]);
    expect(val).toContain('@marketplace');
  }, 20000);
});
