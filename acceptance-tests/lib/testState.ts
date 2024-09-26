import { getTestConfig } from './env';
import { createCli } from './cmd';
import { CLI, TestConfig } from './types';
import { getInitPromptSequence } from './prompt';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import rimraf from 'rimraf';
import { v4 as uuidv4 } from 'uuid';

export class TestState {
  public config: TestConfig;
  public cli: CLI;
  private testConfigFileName: string;
  private parsedYaml: ReturnType<yaml.load>;

  constructor() {
    this.config = getTestConfig();
    this.cli = createCli(this.config);
    this.testConfigFileName = `hs-acceptance-test.config-${uuidv4()}.yml`;
  }

  getPAK() {
    return this.config?.personalAccessKey;
  }

  getTestConfigFileName() {
    return this.testConfigFileName;
  }

  async initializeAuth() {
    try {
      await this.cli.execute(
        ['init', `--c="${this.testConfigFileName}"`],
        getInitPromptSequence(this.getPAK())
      );

      this.parsedYaml = yaml.load(
        readFileSync(this.testConfigFileName, 'utf8')
      );
    } catch (e) {
      console.error(e);
      throw new Error('Failed to initialize CLI config & authentication');
    }
  }

  async withAuth() {
    if (!this.parsedYaml) {
      await this.initializeAuth();
    } else {
      writeFileSync(
        this.testConfigFileName,
        yaml.dump(JSON.parse(JSON.stringify(this.parsedYaml, null, 2)))
      );
    }
  }

  getParsedConfig() {
    const temp = yaml.load(readFileSync(this.testConfigFileName, 'utf8'));
    return JSON.parse(JSON.stringify(temp, null, 2));
  }

  cleanup() {
    rimraf.sync(this.testConfigFileName);
  }
}
