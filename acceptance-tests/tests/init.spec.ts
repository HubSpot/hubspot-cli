vi.mock('open');

import { getInitPromptSequence } from '../lib/prompt';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CONFIG_FILE_NAME } from '../lib/constants';
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';
import TestState from '../lib/testState';

describe('hs init', () => {
  const accountName = 'QA';
  it('should begin with no config file present', async () => {
    expect(existsSync(CONFIG_FILE_NAME)).toBe(false);
  });

  it('should create a new config file', async () => {
    await TestState.cli.execute(
      ['init', `--c="${CONFIG_FILE_NAME}"`],
      getInitPromptSequence(TestState.getPAK(), accountName)
    );

    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });

  it('should create the correct content within the config file', async () => {
    expect(
      yaml.load(readFileSync(CONFIG_FILE_NAME, 'utf8')).portals[0]
        .personalAccessKey
    ).toEqual(TestState.getPAK());
  });

  it('should populate the config file with the correct defaultPortal', async () => {
    const config = yaml.load(readFileSync(CONFIG_FILE_NAME, 'utf8'));
    expect(config.defaultPortal).toEqual(accountName);
  });
});
