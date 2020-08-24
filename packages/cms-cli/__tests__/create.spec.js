/*global banjo */

// TODO: Do we have a way to actually go through the full command?
describe('Create command', () => {
  it('works with help positional', async () =>
    expect(await banjo(['create', 'help'])).toMatchSnapshot());

  it('works with help option', async () =>
    expect(await banjo(['create', '--help'])).toMatchSnapshot());

  describe('edge cases', () => {
    it('creates a valid function with a default destination', async () => {});
    it('does not create a function when a directory that does not exist is chosen', async () => {});
    it('does not create a function when a duplicate name is entered', async () => {});
  });

  describe('personalaccesskey', () => {
    describe('function', () => {
      it('creates a valid function with a destination that exists', async () => {});
    });
    describe('module', () => {
      it('creates a valid module with a destination that exists', async () => {});
    });
    describe('template', () => {
      it('creates a valid template with a destination that exists', async () => {});
    });
    describe('website-theme', () => {
      it('creates a valid website-theme with a destination that exists', async () => {});
    });
    describe('react-app', () => {
      it('creates a valid react-app with a destination that exists', async () => {});
    });
    describe('vue-app', () => {
      it('creates a valid vue-app with a destination that exists', async () => {});
    });
    describe('webpack-serverless', () => {
      it('creates a valid webpack-serverless with a destination that exists', async () => {});
    });
  });

  describe('oauth2', () => {
    describe('function', () => {
      it('creates a valid function with a destination that exists', async () => {});
    });
  });
});
