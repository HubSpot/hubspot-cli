/*global banjo */

describe('Filemanager command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['filemanager', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['filemanager', '--help'])).toMatchSnapshot());
});
