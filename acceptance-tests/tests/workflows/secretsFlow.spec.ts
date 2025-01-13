import { describe, beforeAll, it, expect, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { TestState } from '../../lib/TestState';
import { ENTER } from '../../lib/prompt';

const SECRET = {
  name: uuidv4()
    .toUpperCase()
    .replace(/^[0-9,-]+/g, '') // Remove leading numbers
    .replaceAll('-', '_'),
  value: 'an initial secret value',
};

const secretPollingOptions = {
  interval: 5000,
  timeout: 60000,
};

async function waitForSecretsListToContainSecret(testState: TestState) {
  await expect
    .poll(
      () => testState.cli.executeWithTestConfig(['secrets', 'list']),
      secretPollingOptions
    )
    .toContain(SECRET.name);
}

describe.skip('Secrets Flow', () => {
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

      await waitForSecretsListToContainSecret(testState);
    });
  });

  describe('hs secrets update', () => {
    it('should update the existing secret', async () => {
      // Wait for the secret to exist before updating it
      await waitForSecretsListToContainSecret(testState);

      await testState.cli.executeWithTestConfig(
        ['secrets', 'update', SECRET.name],
        ['a different secret value', ENTER]
      );
    });
  });

  describe('hs secrets delete', () => {
    it('should delete the secret', async () => {
      // Wait for the secret to exist before deleting it
      await waitForSecretsListToContainSecret(testState);

      await testState.cli.executeWithTestConfig(
        ['secrets', 'delete', SECRET.name],
        ['Y', ENTER]
      );

      await expect
        .poll(
          () => testState.cli.executeWithTestConfig(['secrets', 'list']),
          secretPollingOptions
        )
        .not.toContain(SECRET.name);
    });
  });
});
