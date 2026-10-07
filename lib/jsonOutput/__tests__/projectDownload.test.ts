import { ProjectDownloadSchema } from '../projectDownload.js';

describe('lib/jsonOutput/download', () => {
  describe('ProjectDownloadSchema', () => {
    it('should validate a download result', () => {
      expect(
        ProjectDownloadSchema.safeParse({
          projectName: 'my-project',
          buildId: 7,
          dest: '/tmp/my-project',
        }).success
      ).toBe(true);
    });

    it('should reject a result missing the destination', () => {
      expect(
        ProjectDownloadSchema.safeParse({
          projectName: 'my-project',
          buildId: 7,
        }).success
      ).toBe(false);
    });
  });
});
