export interface TestConfig {
  debug: boolean;
  cliVersion: string;
  cliPath: string;
  personalAccessKey: string;
  portalId: string;
  qa: boolean;
  githubToken: string;
}

export interface CLI {
  execute: (args: string[], inputs?: string[], opts?: {}) => Promise<unknown>;
}
