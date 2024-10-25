export interface TestConfig {
  debug: boolean;
  useInstalled: boolean;
  cliPath: string;
  personalAccessKey: string;
  portalId: string;
  qa: boolean;
  githubToken: string;
}

export interface CLI {
  execute: (
    args: string[],
    inputs?: string[],
    opts?: object
  ) => Promise<unknown>;
  executeWithTestConfig: (
    args: string[],
    inputs?: string[],
    opts?: object
  ) => Promise<unknown>;
}
