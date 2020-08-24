/*global banjo */

describe('Upload command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['upload', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['upload', '--help'])).toMatchSnapshot());
});
