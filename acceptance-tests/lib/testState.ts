import { getTestConfig } from './env';
import { createCli } from './cmd';
import { CLI, TestConfig } from './types';

class TestState {
  public config: TestConfig;
  public cli: CLI;

  constructor() {
    this.config = getTestConfig();
    this.cli = createCli(this.config);
  }

  getPAK(): string | undefined {
    return this.config?.personalAccessKey;
  }
}

export default new TestState();
