/*global banjo */

describe('Auth command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['auth', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['auth', '--help'])).toMatchSnapshot());

  // TODO: Do we have a way to actually go through the full command?
  describe('personalaccesskey', () => {
    it('defaults to personalaccesskey', async () => {
      expect(await banjo(['auth'])).toMatchSnapshot();
    });

    it('respects the param', async () => {
      expect(await banjo(['auth', 'personalaccesskey'])).toMatchSnapshot();
    });
  });

  describe('oauth2', () => {
    it('works with oauth2', async () => {
      expect(await banjo(['auth', 'oauth2'])).toMatchSnapshot();
    });
  });
});
