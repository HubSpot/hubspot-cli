/*global banjo */

describe('HubDB command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['hubdb', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['hubdb', '--help'])).toMatchSnapshot());
});
