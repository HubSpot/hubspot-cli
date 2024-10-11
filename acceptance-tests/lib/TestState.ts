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
    this.cli = createCli(this.config);
    this.testConfigFileName = `hs-acceptance-test.config-${uuidv4()}.yml`;
  }

  getPAK() {
    return this.config?.personalAccessKey;
  }

  getTestConfigFileNameRelativeToOutputDir() {
    return this.testConfigFileName;
  }

  getTestConfigFileName() {
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
      await this.cli.execute(
        ['init', `--c="${this.getTestConfigFileNameRelativeToOutputDir()}"`],
        getInitPromptSequence(this.getPAK())
      );

      this.parsedYaml = yaml.load(
        readFileSync(this.getTestConfigFileName(), 'utf8')
      );
    } catch (e) {
      console.error(e);
      // @ts-expect-error TypeScript thinks the cause doesn't exist
      throw new Error('Failed to initialize CLI config & authentication', {
        cause: e,
      });
    }
  }

  async withAuth() {
    if (!this.parsedYaml) {
      await this.initializeAuth();
    } else {
      writeFileSync(
        this.getTestConfigFileName(),
        yaml.dump(JSON.parse(JSON.stringify(this.parsedYaml, null, 2)))
      );
    }
  }

  getParsedConfig() {
    const temp = yaml.load(readFileSync(this.getTestConfigFileName(), 'utf8'));
    return JSON.parse(JSON.stringify(temp, null, 2));
  }

  cleanup() {
    rimraf.sync(this.getTestConfigFileName());
  }
}
