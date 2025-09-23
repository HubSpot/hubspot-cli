import { vi } from 'vitest';

// Create a mock yargs instance with common methods
const mockYargs = {
  positional: vi.fn().mockReturnThis(),
  option: vi.fn().mockReturnThis(),
  conflicts: vi.fn().mockReturnThis(),
  options: vi.fn().mockReturnThis(),
  example: vi.fn().mockReturnThis(),
  command: vi.fn().mockReturnThis(),
  describe: vi.fn().mockReturnThis(),
  demandOption: vi.fn().mockReturnThis(),
  alias: vi.fn().mockReturnThis(),
  default: vi.fn().mockReturnThis(),
  group: vi.fn().mockReturnThis(),
  help: vi.fn().mockReturnThis(),
  version: vi.fn().mockReturnThis(),
  demandCommand: vi.fn().mockReturnThis(),
  middleware: vi.fn().mockReturnThis(),
};

// Declare global type
declare global {
  // eslint-disable-next-line no-var
  var mockYargs;
}

// Make mockYargs available globally
global.mockYargs = mockYargs;

// Mock the yargs module
vi.mock('yargs', () => ({
  default: mockYargs,
}));
// Export the mock instance for direct use in tests if needed
export { mockYargs };
