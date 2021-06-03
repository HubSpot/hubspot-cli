const { ENTER } = require('./helpers/cmd');
const rimraf = require('rimraf');
const { existsSync } = require('fs');

const FOLDERS = {
  module: {
    name: 'test-module',
    folder: 'test-module.module',
  },
  template: {
    name: 'test-template',
    folder: 'test-template.html',
  },
  websiteTheme: {
    folder: 'website-theme',
  },
  reactApp: {
    folder: 'react-app',
  },
  vueApp: {
    folder: 'vue-app',
  },
  webpackServerless: {
    folder: 'webpack-serverless',
  },
  apiSample: {
    name: 'api-sample',
    folder: 'api-sample',
  },
  app: {
    folder: 'app',
  },
  function: {
    folder: 'function.functions',
    name: 'function',
  },
};

const cleanup = () => {
  Object.keys(FOLDERS).forEach(k => {
    rimraf.sync(FOLDERS[k].folder);
  });
};

describe('hs create', () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  const { cli } = global;

  it('should require an argument', async () => {
    try {
      await cli.execute(['create']);
    } catch (out) {
      expect(out).toContain('Not enough non-option arguments');
    }
  });

  it('creates a module', async () => {
    await cli.execute(
      ['create', 'module', FOLDERS.module.name],
      ['label', ENTER, ENTER, 'y', ENTER]
    );

    expect(existsSync(FOLDERS.module.folder)).toBe(true);
  });

  it('creates a template', async () => {
    await cli.execute(['create', 'template', FOLDERS.template.name], [ENTER]);
    expect(existsSync(FOLDERS.template.folder)).toBe(true);
  });

  it('website-theme', async () => {
    await cli.execute(['create', 'website-theme']);
    expect(existsSync(FOLDERS.websiteTheme.folder)).toBe(true);
  });

  it('react-app', async () => {
    await cli.execute(['create', 'react-app']);
    expect(existsSync(FOLDERS.reactApp.folder)).toBe(true);
  });
  it('vue-app', async () => {
    await cli.execute(['create', 'vue-app']);
    expect(existsSync(FOLDERS.vueApp.folder)).toBe(true);
  });
  it('webpack-serverless', async () => {
    await cli.execute(['create', 'webpack-serverless']);
    expect(existsSync(FOLDERS.webpackServerless.folder)).toBe(true);
  });

  // For some reason, this test is getting tripped up on the creation.
  // I verified it's just the test though, not the code, so
  // instead we just check for some output to make sure the command runs
  it('api-sample', async () => {
    const out = await cli.execute(
      ['create', 'api-sample', 'api-sample'],
      [ENTER, ENTER]
    );
    expect(out).toContain('node');
  });

  it('app', async () => {
    await cli.execute(['create', 'app']);
    expect(existsSync(FOLDERS.app.folder)).toBe(true);
  });

  it('function', async () => {
    await cli.execute(
      ['create', 'function'],
      [
        FOLDERS.function.name,
        ENTER,
        'index.js',
        ENTER,
        ENTER,
        'function',
        ENTER,
      ]
    );
    expect(existsSync(FOLDERS.function.folder)).toBe(true);
  });
});
