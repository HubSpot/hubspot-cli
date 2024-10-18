import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { TestState } from '../../lib/TestState';
import { ENTER } from '../../lib/prompt';

const SECRET = {
  name: 'KRABBY_PATTY_SECRET_FORMULA',
  value: 'nice-try-plankton',
};

describe('Secrets Flow', () => {
  let testState: TestState;

  beforeAll(async () => {
    testState = new TestState();
    await testState.withAuth();
  });

  afterAll(() => {
    testState.cleanup();
  });

  describe('hs secrets add', () => {
    it('should create a new secret', async () => {
      await testState.cli.executeWithTestConfig(
        ['secrets', 'add', SECRET.name],
        [SECRET.value, ENTER]
      );
    });
  });

  describe('hs secrets list', () => {
    it('should list the secret', async () => {
      const output = await testState.cli.executeWithTestConfig([
        'secrets',
        'list',
      ]);

      expect(output).toContain(SECRET.name);
    });
  });

  describe('hs secrets update', () => {
    it('should update the existing secret', async () => {
      await testState.cli.executeWithTestConfig(
        ['secrets', 'update', SECRET.name],
        ['ok fine the recipe is...', ENTER]
      );
    });
  });

  describe('hs secrets delete', () => {
    it('should delete the secret', async () => {
      await testState.cli.executeWithTestConfig([
        'secrets',
        'delete',
        SECRET.name,
      ]);
    });
  });

  describe('hs secrets list', () => {
    it('should not list the secret', async () => {
      const output = await testState.cli.executeWithTestConfig([
        'secrets',
        'list',
      ]);

      expect(output).not.toContain(SECRET.name);
    });
  });
});
