import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TestState } from '../../lib/TestState';
import { ENTER } from '../../lib/prompt';
import { sleep } from '../../lib/sleep';

const SECRET = {
  name: uuidv4()
    .toUpperCase()
    .replace(/^[0-9,-]+/g, '') // Remove leading numbers
    .replaceAll('-', '_'),
  value: 'an initial secret value',
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

      // Wait for the secret to be added
      await sleep(1000);
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
        ['a different secret value', ENTER]
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
