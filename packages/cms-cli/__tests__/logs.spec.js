/*global banjo */

describe('Logs command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['logs', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['logs', '--help'])).toMatchSnapshot());
});
