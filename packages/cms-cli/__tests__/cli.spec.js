/*global banjo */

describe('CLI Top Level', () => {
  it('works with help positional', async () =>
    expect(await banjo(['help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['--help'])).toMatchSnapshot());

  it('errors with no input', async () => {
    try {
      await banjo();
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        "[ERROR] Please specifiy a command or run \`banjo --help\` for a list of available commands
        "
      `);
    }
  });
});
