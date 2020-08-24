/*global banjo */

describe('Fetch command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['fetch', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['fetch', '--help'])).toMatchSnapshot());
});
