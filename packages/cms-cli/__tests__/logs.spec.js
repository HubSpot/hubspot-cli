/*global banjo */
const { HS_CONFIG_PATH } = require('./utils/utils');

describe('Logs command', () => {
  it('works with help positional', async () =>
    expect(
      await banjo(['logs', 'help', `-c${HS_CONFIG_PATH}`])
    ).toMatchSnapshot());

  it('works with help option', async () =>
    expect(
      await banjo(['logs', '--help', `-c${HS_CONFIG_PATH}`])
    ).toMatchSnapshot());
});
