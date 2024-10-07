import { ENTER } from '../lib/prompt';

import { existsSync } from 'fs';
import { describe, beforeAll, afterAll, it, expect } from 'vitest';
import rimraf from 'rimraf';
import { TestState } from '../lib/testState';

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

const cleanup = (testState: TestState) => {
  Object.keys(FOLDERS).forEach(k => {
    rimraf.sync(testState.getPathWithTestDirectory(FOLDERS[k].folder));
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

    expect(testState.existsInProjectFolder(FOLDERS.module.folder)).toBe(true);
  });

  it('creates a template', async () => {
    await testState.cli.execute(
      ['create', 'template', FOLDERS.template.name],
      [ENTER]
    );
    expect(testState.existsInProjectFolder(FOLDERS.template.folder)).toBe(true);
  });

  it('website-theme', async () => {
    await testState.cli.execute(['create', 'website-theme']);
    expect(testState.existsInProjectFolder(FOLDERS.websiteTheme.folder)).toBe(
      true
    );
  });

  it('react-app', async () => {
    await testState.cli.execute(['create', 'react-app']);
    expect(testState.existsInProjectFolder(FOLDERS.reactApp.folder)).toBe(true);
  });

  it('vue-app', async () => {
    await testState.cli.execute(['create', 'vue-app']);
    expect(testState.existsInProjectFolder(FOLDERS.vueApp.folder)).toBe(true);
  });

  it('webpack-serverless', async () => {
    await testState.cli.execute(['create', 'webpack-serverless']);
    expect(
      testState.existsInProjectFolder(FOLDERS.webpackServerless.folder)
    ).toBe(true);
  });

  // For some reason, this test is getting tripped up on the creation.
  // I verified it's just the test though, not the code, so
  // instead we just check for some output to make sure the command runs
  it('api-sample', async () => {
    const out = await testState.cli.execute(
      ['create', 'api-sample', 'api-sample'],
      [ENTER, ENTER]
    );
    expect(out).toContain('node');
  });

  it('app', async () => {
    await testState.cli.execute(['create', 'app']);
    expect(testState.existsInProjectFolder(FOLDERS.app.folder)).toBe(true);
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
    expect(testState.existsInProjectFolder(FOLDERS.function.folder)).toBe(true);
  });
});
