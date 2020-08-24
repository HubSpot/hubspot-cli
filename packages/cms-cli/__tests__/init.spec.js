/*global banjo */
const { tolerantMove } = require('./utils/utils');

// TODO: We are running tests sequentially right now because of the `hubspot.config.yml` moving and other commands needing it there
// How do we get around this?
describe('Init Command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['init', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['init', '--help'])).toMatchSnapshot());

  // TODO: So it doesn't actually create a file right now... not sure if it's
  // a permission thing?
  it('initializes a new hubspot config', async () => {
    tolerantMove('hubspot.config.yml', 'hubspot.config.yml.bak');
    await banjo('init');
    tolerantMove('hubspot.config.yml.bak', 'hubspot.config.yml');
  });

  it('bails if hubspot.config.yml already exists', async () => {
    try {
      await banjo('init');
    } catch (e) {
      expect(e).toMatchInlineSnapshot(`
        "[ERROR] The config file '/Users/ajenkins/src/hubspot-cms-tools/packages/cms-cli/hubspot.config.yml' already exists.
        "
      `);
    }
  });

  it('respects hidden QA mode', async () => {
    tolerantMove('hubspot.config.yml', 'hubspot.config.yml.bak');
    await banjo('init', '--qa');
    tolerantMove('hubspot.config.yml.bak', 'hubspot.config.yml');
  });
});
