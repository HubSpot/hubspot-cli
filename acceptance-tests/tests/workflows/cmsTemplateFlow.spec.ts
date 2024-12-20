import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TestState } from '../../lib/TestState';
import { ENTER } from '../../lib/prompt';

const TEMPLATE_NAME = uuidv4();
const TEMPLATE_FOLDER = `${TEMPLATE_NAME}.html`;
const NEW_TEMPLATE_FOLDER = `${uuidv4()}.html`;

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
    it('should create a CMS template', async () => {
      await testState.cli.executeWithTestConfig(
        ['create', 'template', TEMPLATE_NAME],
        [ENTER]
      );
      expect(testState.existsInTestOutputDirectory(TEMPLATE_FOLDER)).toBe(true);
    });
  });

  describe('hs upload', () => {
    it('should upload the template to the Design Manager', async () => {
      await testState.cli.executeWithTestConfig([
        'upload',
        `--src=${TEMPLATE_FOLDER}`,
        `--dest=${TEMPLATE_FOLDER}`,
      ]);
    });
  });

  describe('hs list', () => {
    it('should validate that the template exists in the Design Manager', async () => {
      const val = await testState.cli.executeWithTestConfig(['list']);
      expect(val).toContain(TEMPLATE_FOLDER);
    });
  });

  describe('hs mv', () => {
    it('should move the file to a new location in the Design Manager', async () => {
      const val = await testState.cli.executeWithTestConfig([
        'mv',
        TEMPLATE_FOLDER,
        NEW_TEMPLATE_FOLDER,
      ]);
      expect(val).toContain(TEMPLATE_FOLDER);
    });
  });

  describe('hs list', () => {
    it('should validate that the template exists in the Design Manager', async () => {
      const val = await testState.cli.executeWithTestConfig(['list']);
      expect(val).not.toContain(TEMPLATE_FOLDER);
      expect(val).toContain(NEW_TEMPLATE_FOLDER);
    });
  });

  describe('hs remove', () => {
    it('should delete the template from Design Manager', async () => {
      await testState.cli.executeWithTestConfig([
        'remove',
        NEW_TEMPLATE_FOLDER,
      ]);
    });
  });

  describe('hs list', () => {
    it('should validate that the template does not exist in the Design Manager', async () => {
      const val = await testState.cli.executeWithTestConfig(['list']);
      expect(val).not.toContain(NEW_TEMPLATE_FOLDER);
    });
  });
});
