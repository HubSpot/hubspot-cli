import { ENTER } from './helpers/cmd';
import { describe, it, expect, beforeEach } from 'vitest';
import { CONFIG_FILE_NAME } from '../lib/constants';
import { existsSync, readFileSync } from 'fs';
import yaml from 'js-yaml';

describe('hs init', () => {
  it('should begin with no config file present', async () => {
    expect(existsSync(CONFIG_FILE_NAME)).toBe(false);
  });

  it('should create a new config file', async () => {
    await global.cli.execute(
      ['init', `--c="${CONFIG_FILE_NAME}"`],
      [global.config.personalAccessKey, ENTER, 'QA', ENTER]
    );

    expect(existsSync(CONFIG_FILE_NAME)).toBe(true);
  });

  it('should create the correct content within the config file', async () => {
    expect(
      yaml.load(readFileSync(CONFIG_FILE_NAME, 'utf8')).portals[0]
        .personalAccessKey
    ).toEqual(global.config.personalAccessKey);
  });

  it('should populate the config file with the correct defaultPortal', async () => {
    const config = yaml.load(readFileSync(CONFIG_FILE_NAME, 'utf8'));
    expect(config.defaultPortal).toEqual('QA');
  });
});
