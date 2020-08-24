/*global banjo */

describe('Secrets command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['secrets', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['secrets', '--help'])).toMatchSnapshot());
});
