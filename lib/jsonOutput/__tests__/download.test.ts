import { DownloadSchema } from '../download.js';

describe('lib/jsonOutput/download', () => {
  describe('DownloadSchema', () => {
    it('should validate a download result', () => {
      expect(
        DownloadSchema.safeParse({
          projectName: 'my-project',
          buildId: 7,
          dest: '/tmp/my-project',
        }).success
      ).toBe(true);
    });

    it('should reject a result missing the destination', () => {
      expect(
        DownloadSchema.safeParse({ projectName: 'my-project', buildId: 7 })
          .success
      ).toBe(false);
    });
  });
});
