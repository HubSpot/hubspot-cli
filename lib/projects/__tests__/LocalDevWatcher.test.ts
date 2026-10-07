import chokidar, { FSWatcher } from 'chokidar';
import LocalDevWatcher from '../localDev/LocalDevWatcher.js';
import LocalDevProcess from '../localDev/LocalDevProcess.js';

vi.mock('chokidar');

const mockedChokidarWatch = vi.mocked(chokidar.watch);

describe('lib/projects/localDev/LocalDevWatcher', () => {
  const mockProjectDir = '/path/to/project';
  let mockLocalDevProcess: LocalDevProcess;

  beforeEach(() => {
    mockedChokidarWatch.mockReturnValue({
      on: vi.fn(),
      close: vi.fn(),
    } as unknown as FSWatcher);

    mockLocalDevProcess = {
      projectDir: mockProjectDir,
      projectNodes: {},
    } as unknown as LocalDevProcess;
  });

  describe('start()', () => {
    it('should watch the project directory while ignoring node_modules and dist', () => {
      new LocalDevWatcher(mockLocalDevProcess).start();

      expect(mockedChokidarWatch).toHaveBeenCalledWith(mockProjectDir, {
        ignoreInitial: true,
        ignored: ['**/dist', '**/node_modules'],
      });
    });
  });
});
