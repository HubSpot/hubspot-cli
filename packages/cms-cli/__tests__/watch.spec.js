/*global banjo */

describe('Watch command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['watch', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['watch', '--help'])).toMatchSnapshot());
});
