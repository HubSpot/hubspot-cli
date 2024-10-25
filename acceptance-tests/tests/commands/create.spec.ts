import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import rimraf from 'rimraf';
import { ENTER } from '../../lib/prompt';
import { TestState } from '../../lib/TestState';

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
    name: 'website-theme',
  },
  reactApp: {
    folder: 'react-app',
    name: 'react-app',
  },
  vueApp: {
    folder: 'vue-app',
    name: 'vue-app',
  },
  webpackServerless: {
    folder: 'webpack-serverless',
    name: 'webpack-serverless',
  },
  apiSample: {
    name: 'api-sample',
    folder: 'api-sample',
  },
  app: {
    folder: 'app',
    name: 'app',
  },
  function: {
    folder: 'function.functions',
    name: 'function',
  },
};

const cleanup = (testState: TestState) => {
  Object.keys(FOLDERS).forEach(k => {
    rimraf.sync(testState.getPathWithinTestDirectory(FOLDERS[k].folder));
  });
};

describe('hs create', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
    cleanup(testState);
  });

  afterAll(() => {
    testState.cleanup();
    cleanup(testState);
  });

  it('should require an argument', async () => {
    expect(async () => testState.cli.execute(['create'])).rejects.toThrowError(
      /Not enough non-option arguments/
    );
  });

  it('creates a module', async () => {
    await testState.cli.execute(
      ['create', 'module', FOLDERS.module.name],
      ['label', ENTER, ENTER, ENTER, 'y', ENTER]
    );

    expect(testState.existsInTestOutputDirectory(FOLDERS.module.folder)).toBe(
      true
    );
  });

  it('creates a template', async () => {
    await testState.cli.execute(
      ['create', 'template', FOLDERS.template.name],
      [ENTER]
    );
    expect(testState.existsInTestOutputDirectory(FOLDERS.template.folder)).toBe(
      true
    );
  });

  it('website-theme', async () => {
    await testState.cli.execute(['create', FOLDERS.websiteTheme.name]);
    expect(
      testState.existsInTestOutputDirectory(FOLDERS.websiteTheme.folder)
    ).toBe(true);
  });

  it('react-app', async () => {
    await testState.cli.execute(['create', FOLDERS.reactApp.name]);
    expect(testState.existsInTestOutputDirectory(FOLDERS.reactApp.folder)).toBe(
      true
    );
  });

  it('vue-app', async () => {
    await testState.cli.execute(['create', FOLDERS.vueApp.name]);
    expect(testState.existsInTestOutputDirectory(FOLDERS.vueApp.folder)).toBe(
      true
    );
  });

  it('webpack-serverless', async () => {
    await testState.cli.execute(['create', FOLDERS.webpackServerless.name]);
    expect(
      testState.existsInTestOutputDirectory(FOLDERS.webpackServerless.folder)
    ).toBe(true);
  });

  it('api-sample', async () => {
    await testState.cli.execute(
      ['create', FOLDERS.apiSample.name, FOLDERS.apiSample.name],
      [ENTER, ENTER]
    );

    expect(
      testState.existsInTestOutputDirectory(FOLDERS.apiSample.folder)
    ).toBe(true);
  });

  it('app', async () => {
    await testState.cli.execute(['create', FOLDERS.app.name]);
    expect(testState.existsInTestOutputDirectory(FOLDERS.app.folder)).toBe(
      true
    );
  });

  it('function', async () => {
    await testState.cli.execute(
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
    expect(testState.existsInTestOutputDirectory(FOLDERS.function.folder)).toBe(
      true
    );
  });
});
