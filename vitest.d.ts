import { Mock } from 'vitest';

interface MockYargs {
  positional: Mock;
  option: Mock;
  middleware: Mock;
  options: Mock;
  example: Mock;
  conflicts: Mock;
  command: Mock;
  describe: Mock;
  demandOption: Mock;
  alias: Mock;
  default: Mock;
  group: Mock;
  help: Mock;
  version: Mock;
  demandCommand: Mock;
}

declare global {
  // eslint-disable-next-line no-var
  var mockYargs: MockYargs;
}
