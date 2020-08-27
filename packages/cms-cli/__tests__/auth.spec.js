/*global banjo */
const { HS_CONFIG_PATH } = require('./utils/utils');

describe('Auth command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['auth', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['auth', '--help'])).toMatchSnapshot());

  // TODO: Need to resolve not having a hubspot.config.yml
  xdescribe('personalaccesskey', () => {
    it('defaults to personalaccesskey', async () => {
      expect(await banjo(['auth', `-c${HS_CONFIG_PATH}`])).toMatchSnapshot();
    });

    it('respects the param', async () => {
      expect(
        await banjo(['auth', 'personalaccesskey', `-c${HS_CONFIG_PATH}`])
      ).toMatchSnapshot();
    });
  });

  xdescribe('oauth2', () => {
    it('works with oauth2', async () => {
      expect(
        await banjo(['auth', 'oauth2', `-c${HS_CONFIG_PATH}`])
      ).toMatchSnapshot();
    });
  });
});
