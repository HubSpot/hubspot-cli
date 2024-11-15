import { existsSync, readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import rimraf from 'rimraf';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'node:path';
import { getTestConfig } from './env';
import { createCli } from './cmd';
import { CLI, TestConfig } from './types';
import { getInitPromptSequence } from './prompt';

export const testOutputDir = 'test-output';

export class TestState {
  public config: TestConfig;
  public cli: CLI;
  private testConfigFileName: string;
  private parsedYaml: ReturnType<typeof yaml.load>;

  constructor() {
    this.config = getTestConfig();
    this.testConfigFileName = `hs-acceptance-test.config-${uuidv4()}.yml`;
    this.cli = createCli(this.config, this.testConfigFileName);
  }

  getPAK() {
    return this.config?.personalAccessKey;
  }

  getTestConfigPathRelativeToOutputDir() {
    return this.testConfigFileName;
  }

  getTestConfigPath() {
    return this.getPathWithinTestDirectory(this.testConfigFileName);
  }

  getPathWithinTestDirectory(filepath: string) {
    return path.join(testOutputDir, filepath);
  }

  existsInTestOutputDirectory(filepath: string) {
    return existsSync(this.getPathWithinTestDirectory(filepath));
  }

  async initializeAuth() {
    try {
      await this.cli.executeWithTestConfig(
        ['init', '--disable-tracking'],
        getInitPromptSequence(this.getPAK())
      );

      await this.cli.executeWithTestConfig([
        'config',
        'set',
        '--allowUsageTracking=false',
      ]);

      this.parsedYaml = yaml.load(
        readFileSync(this.getTestConfigPath(), 'utf8')
      );
    } catch (e) {
      console.error(e);
      throw new Error('Failed to initialize CLI config & authentication', {
        cause: e,
      });
    }

    // @ts-expect-error Non-existent field according to TS
    if (this.parsedYaml?.allowUsageTracking) {
      throw new Error('Usage tracking should be disabled');
    }
  }

  async withAuth() {
    if (!this.parsedYaml) {
      await this.initializeAuth();
    } else {
      writeFileSync(
        this.getTestConfigPath(),
        yaml.dump(JSON.parse(JSON.stringify(this.parsedYaml, null, 2)))
      );
    }
  }

  getParsedConfig() {
    const temp = yaml.load(readFileSync(this.getTestConfigPath(), 'utf8'));
    return JSON.parse(JSON.stringify(temp, null, 2));
  }

  cleanup() {
    rimraf.sync(this.getTestConfigPath());
  }
}
