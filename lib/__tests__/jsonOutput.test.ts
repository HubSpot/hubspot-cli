import { mapReleaseToJsonOutput } from '../jsonOutput.js';
import { Release } from '../../api/releases.js';

describe('lib/jsonOutput', () => {
  describe('mapReleaseToJsonOutput()', () => {
    it('should map release fields', () => {
      const release: Release = {
        releaseTag: 'v1.0.0',
        buildId: 42,
        createdAt: '2026-01-01T00:00:00Z',
      };

      expect(mapReleaseToJsonOutput(release)).toEqual({
        releaseTag: 'v1.0.0',
        buildId: 42,
        createdAt: '2026-01-01T00:00:00Z',
        components: undefined,
      });
    });

    it('should map components when present', () => {
      const release: Release = {
        releaseTag: 'v2.0.0',
        buildId: 99,
        createdAt: '2026-06-15T12:00:00Z',
        components: [
          {
            buildType: 'APP',
            buildName: 'my-app',
            rootPath: 'src/app',
            id: 'abc-123',
          },
          {
            buildType: 'THEME',
            buildName: 'my-theme',
          },
        ],
      };

      expect(mapReleaseToJsonOutput(release)).toEqual({
        releaseTag: 'v2.0.0',
        buildId: 99,
        createdAt: '2026-06-15T12:00:00Z',
        components: [
          {
            buildType: 'APP',
            buildName: 'my-app',
            rootPath: 'src/app',
            id: 'abc-123',
          },
          {
            buildType: 'THEME',
            buildName: 'my-theme',
            rootPath: undefined,
            id: undefined,
          },
        ],
      });
    });

    it('should not include extra fields from the release object', () => {
      const release = {
        releaseTag: 'v1.0.0',
        buildId: 1,
        createdAt: '2026-01-01T00:00:00Z',
        internalField: 'should-not-appear',
        secretToken: 'abc',
      } as unknown as Release;

      const result = mapReleaseToJsonOutput(release);

      expect(result).not.toHaveProperty('internalField');
      expect(result).not.toHaveProperty('secretToken');
      expect(Object.keys(result)).toEqual([
        'releaseTag',
        'buildId',
        'createdAt',
        'components',
      ]);
    });

    it('should not include extra fields from component objects', () => {
      const release = {
        releaseTag: 'v1.0.0',
        buildId: 1,
        createdAt: '2026-01-01T00:00:00Z',
        components: [
          {
            buildType: 'APP',
            buildName: 'app',
            rootPath: 'src',
            id: '1',
            internalStatus: 'PENDING',
          },
        ],
      } as unknown as Release;

      const result = mapReleaseToJsonOutput(release);

      expect(result.components![0]).not.toHaveProperty('internalStatus');
      expect(Object.keys(result.components![0])).toEqual([
        'buildType',
        'buildName',
        'rootPath',
        'id',
      ]);
    });
  });
});
