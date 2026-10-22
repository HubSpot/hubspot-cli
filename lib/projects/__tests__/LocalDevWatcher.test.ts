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
    it('should watch the project directory and ignore initial files', () => {
      new LocalDevWatcher(mockLocalDevProcess).start();

      expect(mockedChokidarWatch).toHaveBeenCalledWith(
        mockProjectDir,
        expect.objectContaining({ ignoreInitial: true })
      );
    });

    it('should ignore node_modules and dist directories at any depth', () => {
      new LocalDevWatcher(mockLocalDevProcess).start();
      const { ignored } = mockedChokidarWatch.mock.calls[0][1] as {
        ignored: (filePath: string) => boolean;
      };

      expect(ignored(`${mockProjectDir}/node_modules`)).toBe(true);
      expect(ignored(`${mockProjectDir}/src/app/node_modules`)).toBe(true);
      expect(ignored(`${mockProjectDir}/dist`)).toBe(true);
      expect(ignored(`${mockProjectDir}/src/app/cards/dist`)).toBe(true);
    });

    it('should not ignore other files and directories', () => {
      new LocalDevWatcher(mockLocalDevProcess).start();
      const { ignored } = mockedChokidarWatch.mock.calls[0][1] as {
        ignored: (filePath: string) => boolean;
      };

      expect(ignored(mockProjectDir)).toBe(false);
      expect(ignored(`${mockProjectDir}/src/app/app-hsmeta.json`)).toBe(false);
      expect(ignored(`${mockProjectDir}/src/app/distribution`)).toBe(false);
      expect(ignored(`${mockProjectDir}/src/app/cards/dist.js`)).toBe(false);
    });
  });
});
