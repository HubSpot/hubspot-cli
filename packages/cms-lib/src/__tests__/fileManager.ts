import { uploadFolder } from '../fileManager';
import { uploadFile } from '../api/fileManager';
import { walk } from '../lib/walk';
import { createIgnoreFilter } from '../ignoreRules';

jest.mock('../lib/walk');
jest.mock('../api/fileManager');
jest.mock('../ignoreRules');

const walkMock = walk as jest.Mock<Promise<Array<String>>>;
const uploadFileMock = uploadFile as jest.Mock;
const createIgnoreFilterMock = createIgnoreFilter as jest.Mock;

describe('uploadFolder', () => {
  describe('uploadFolder()', () => {
    it('uploads files in the folder', async () => {
      const files = [
        'folder/document.pdf',
        'folder/images/image.png',
        'folder/images/image.jpg',
        'folder/video/video.mp4',
      ];

      walkMock.mockResolvedValue(files);
      uploadFileMock.mockImplementation(() => Promise.resolve());
      createIgnoreFilterMock.mockImplementation(() => () => true);

      const portalId = 123;
      const src = 'folder';
      const dest = 'folder';

      await uploadFolder(portalId, src, dest, { cwd: '/home/tom' });

      expect(uploadFile).toReturnTimes(4);

      files.forEach((file, index) => {
        expect(uploadFile).nthCalledWith(index + 1, portalId, file, file);
      });
    });
  });
});
