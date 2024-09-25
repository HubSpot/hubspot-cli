import { getInitPromptSequence } from '../lib/prompt';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import { TestState } from '../lib/testState';

describe('hs init', () => {
  let testState: TestState;
  const accountName = 'QA';

  beforeAll(() => {
    testState = new TestState();
  });

  afterAll(() => {
    testState.cleanup();
  });

  it('should begin with no config file present', async () => {
    expect(existsSync(testState.getTestConfigFileName())).toBe(false);
  });

  it('should create a new config file', async () => {
    await testState.cli.execute(
      ['init', `--c="${testState.getTestConfigFileName()}"`],
      getInitPromptSequence(testState.getPAK(), accountName)
    );

    expect(existsSync(testState.getTestConfigFileName())).toBe(true);
  });

  it('should create the correct content within the config file', async () => {
    expect(
      yaml.load(readFileSync(testState.getTestConfigFileName(), 'utf8'))
        .portals[0].personalAccessKey
    ).toEqual(testState.getPAK());
  });

  it('should populate the config file with the correct defaultPortal', async () => {
    const config = yaml.load(
      readFileSync(testState.getTestConfigFileName(), 'utf8')
    );
    expect(config.defaultPortal).toEqual(accountName);
  });
});
