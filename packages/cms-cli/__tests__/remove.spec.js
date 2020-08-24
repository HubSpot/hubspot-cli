/*global banjo */

describe('Remove command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['remove', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['remove', '--help'])).toMatchSnapshot());
});
