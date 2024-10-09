import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { TestState } from '../../lib/TestState';
import { ENTER } from '../../lib/prompt';

const TEMPLATE = {
  name: 'test-template',
  folder: 'test-template.html',
};

describe('CMS Template Flow', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
  });

  afterAll(() => {
    testState.cleanup();
  });

  describe('hs create', () => {
    it('creates a template', async () => {});

    it('should create a CMS template', async () => {
      await testState.cli.execute(
        ['create', 'template', TEMPLATE.name],
        [ENTER]
      );
      expect(testState.existsInTestOutputDirectory(TEMPLATE.folder)).toBe(true);
    });
  });

  describe('hs upload', () => {
    it('should upload the template to the Design Manager', async () => {
      await testState.cli.execute([
        'upload',
        `--src=${TEMPLATE.folder}`,
        `--dest=${TEMPLATE.folder}`,
        `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
      ]);
    });
  });

  describe('hs list', () => {
    it('should validate that the template exists in the Design Manager', async () => {
      const val = await testState.cli.execute([
        'list',
        `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
      ]);
      expect(val).toContain(TEMPLATE.folder);
    });
  });

  describe('hs remove', () => {
    it('should delete the template from Design Manager', async () => {
      await testState.cli.execute([
        'remove',
        TEMPLATE.folder,
        `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
      ]);
    });
  });

  describe('hs list', () => {
    it('should validate that the template does not exist in the Design Manager', async () => {
      const val = await testState.cli.execute([
        'list',
        `--c="${testState.getTestConfigFileNameRelativeToOutputDir()}"`,
      ]);
      expect(val).not.toContain(TEMPLATE.folder);
    });
  });
});
