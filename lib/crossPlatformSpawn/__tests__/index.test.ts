import fs from 'fs';
import { spawn } from 'node:child_process';
import { lib } from '../../../lang/en.js';
import { crossPlatformSpawn } from '../index.js';

vi.mock('node:child_process');

const mockedSpawn = vi.mocked(spawn);
const statSyncSpy = vi.spyOn(fs, 'statSync');

const ORIGINAL_PLATFORM = process.platform;

const mockChild = {} as unknown as ReturnType<typeof spawn>;
const mockGlobalShim = 'C:\\Users\\me\\AppData\\Roaming\\npm\\hs.cmd';
const mockLocalShim = 'C:\\proj\\node_modules\\.bin\\hs.cmd';
const mockArgs = ['project', 'a b(c)'];
const mockOptions = {
  cwd: 'C:\\work',
  env: { PATH: 'C:\\Windows;C:\\Users\\me\\AppData\\Roaming\\npm' },
};
const SINGLE_ESCAPED_LINE = '"hs ^"project^" ^"a^ b^(c^)^""';
const DOUBLE_ESCAPED_LINE = '"hs ^^^"project^^^" ^^^"a^^^ b^^^(c^^^)^^^""';

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

function mockExistingFiles(files: string[]): void {
  const existingFiles = new Set(files.map(file => file.toLowerCase()));

  statSyncSpy.mockImplementation(filePath => {
    if (!existingFiles.has(String(filePath).toLowerCase())) {
      throw new Error('ENOENT');
    }
    return { isFile: () => true } as unknown as ReturnType<typeof fs.statSync>;
  });
}

describe('lib/crossPlatformSpawn/index', () => {
  beforeEach(() => {
    mockedSpawn.mockReturnValue(mockChild);
    mockExistingFiles([]);
  });

  afterEach(() => {
    setPlatform(ORIGINAL_PLATFORM);
    vi.unstubAllEnvs();
  });

  describe('crossPlatformSpawn()', () => {
    describe('on other platforms', () => {
      beforeEach(() => {
        setPlatform('linux');
      });

      it('should pass the command, args and options straight to spawn', () => {
        const result = crossPlatformSpawn('hs', mockArgs, mockOptions);

        expect(mockedSpawn).toHaveBeenCalledWith('hs', mockArgs, mockOptions);
        expect(result).toBe(mockChild);
      });

      it('should not restrict args', () => {
        const args = ['say "hi" & echo 100%', 'C:\\dir\\\\'];

        crossPlatformSpawn('hs', args, mockOptions);

        expect(mockedSpawn).toHaveBeenCalledWith('hs', args, mockOptions);
      });
    });

    describe('on Windows', () => {
      beforeEach(() => {
        setPlatform('win32');
        vi.stubEnv('comspec', '');
        vi.stubEnv('PATHEXT', '.EXE;.CMD');
      });

      it('should run a global .cmd shim through cmd.exe with single escaping', () => {
        mockExistingFiles([mockGlobalShim]);

        const result = crossPlatformSpawn('hs', mockArgs, mockOptions);

        expect(mockedSpawn).toHaveBeenCalledWith(
          'cmd.exe',
          ['/d', '/s', '/c', SINGLE_ESCAPED_LINE],
          {
            cwd: mockOptions.cwd,
            env: {
              ...mockOptions.env,
              NoDefaultCurrentDirectoryInExePath: '1',
            },
            windowsVerbatimArguments: true,
          }
        );
        expect(result).toBe(mockChild);
      });

      it('should escape twice for a .cmd shim in node_modules/.bin', () => {
        mockExistingFiles([mockLocalShim]);

        crossPlatformSpawn('hs', mockArgs, {
          cwd: mockOptions.cwd,
          env: { PATH: 'C:\\proj\\node_modules\\.bin' },
        });

        expect(mockedSpawn).toHaveBeenCalledWith(
          'cmd.exe',
          ['/d', '/s', '/c', DOUBLE_ESCAPED_LINE],
          expect.any(Object)
        );
      });

      it('should escape once when the command cannot be found', () => {
        crossPlatformSpawn('hs', mockArgs, mockOptions);

        expect(mockedSpawn).toHaveBeenCalledWith(
          'cmd.exe',
          ['/d', '/s', '/c', SINGLE_ESCAPED_LINE],
          expect.any(Object)
        );
      });

      it('should use the shell from the comspec environment variable when it is set', () => {
        vi.stubEnv('comspec', 'C:\\Windows\\System32\\cmd.exe');

        crossPlatformSpawn('hs', mockArgs, mockOptions);

        expect(mockedSpawn).toHaveBeenCalledWith(
          'C:\\Windows\\System32\\cmd.exe',
          expect.any(Array),
          expect.any(Object)
        );
      });

      it('should normalize forward slashes in the command', () => {
        crossPlatformSpawn('C:/bin/tool.cmd', [], mockOptions);

        expect(mockedSpawn).toHaveBeenCalledWith(
          'cmd.exe',
          ['/d', '/s', '/c', '"C:\\bin\\tool.cmd"'],
          expect.any(Object)
        );
      });

      it('should not modify the env it was given', () => {
        const env = { PATH: 'C:\\npm' };

        crossPlatformSpawn('hs', mockArgs, { cwd: mockOptions.cwd, env });

        expect(env).toEqual({ PATH: 'C:\\npm' });
      });

      it.each(['"', '%', '^', '&', '|', '<', '>', '\n', '\r'])(
        'should reject an arg containing %j without spawning',
        character => {
          const arg = `say ${character} hi`;

          expect(() => crossPlatformSpawn('hs', [arg], mockOptions)).toThrow(
            lib.crossPlatformSpawn.unsafeArg(arg)
          );

          expect(mockedSpawn).not.toHaveBeenCalled();
        }
      );

      it.each(['C:\\dir\\\\', 'C:\\dir\\\\\\\\'])(
        'should reject an arg ending in two or more backslashes: %s',
        arg => {
          expect(() => crossPlatformSpawn('hs', [arg], mockOptions)).toThrow(
            lib.crossPlatformSpawn.unsafeArg(arg)
          );

          expect(mockedSpawn).not.toHaveBeenCalled();
        }
      );

      it.each([
        'C:\\dir\\',
        'C:\\dir\\\\sub\\file.txt',
        "Fix the upload flow, add retries (v2); it's faster!",
        '日本語 é',
        '',
      ])('should allow the arg %j', arg => {
        expect(() =>
          crossPlatformSpawn('hs', [arg], mockOptions)
        ).not.toThrow();
      });

      it('should reject the first unsafe arg when several are given', () => {
        expect(() =>
          crossPlatformSpawn('hs', ['ok', 'a | b', 'c & d'], mockOptions)
        ).toThrow(lib.crossPlatformSpawn.unsafeArg('a | b'));
      });
    });
  });
});
