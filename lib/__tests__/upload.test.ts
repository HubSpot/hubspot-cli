import { walk } from '@hubspot/local-dev-lib/fs';
import { createIgnoreFilter } from '@hubspot/local-dev-lib/ignoreRules';
import { isConvertableFieldJs } from '@hubspot/local-dev-lib/cms/handleFieldsJS';
import { isAllowedExtension } from '@hubspot/local-dev-lib/path';
import { fieldsJsPrompt } from '../prompts/cmsFieldPrompt.js';
import { logError } from '../errorHandlers/index.js';
import { getUploadableFileList } from '../upload.js';

vi.mock('@hubspot/local-dev-lib/fs');
vi.mock('@hubspot/local-dev-lib/ignoreRules');
vi.mock('@hubspot/local-dev-lib/cms/handleFieldsJS');
vi.mock('@hubspot/local-dev-lib/path');
vi.mock('../prompts/cmsFieldPrompt.js');
vi.mock('../errorHandlers/index.js');

const mockedWalk = vi.mocked(walk);
const mockedCreateIgnoreFilter = vi.mocked(createIgnoreFilter);
const mockedIsConvertableFieldJs = vi.mocked(isConvertableFieldJs);
const mockedIsAllowedExtension = vi.mocked(isAllowedExtension);
const mockedFieldsJsPrompt = vi.mocked(fieldsJsPrompt);
const mockedLogError = vi.mocked(logError);

const MOCK_SRC = '/path/to/src';
const MOCK_FILES = [
  '/path/to/src/template.html',
  '/path/to/src/module.module/module.html',
  '/path/to/src/styles.css',
];

describe('lib/upload', () => {
  describe('getUploadableFileList()', () => {
    beforeEach(() => {
      mockedWalk.mockResolvedValue(MOCK_FILES);
      mockedIsAllowedExtension.mockReturnValue(true);
      mockedCreateIgnoreFilter.mockReturnValue(() => true);
      mockedIsConvertableFieldJs.mockReturnValue(false);
    });

    it('should walk the provided source directory', async () => {
      await getUploadableFileList(MOCK_SRC);

      expect(mockedWalk).toHaveBeenCalledWith(MOCK_SRC);
    });

    it('should return all files when every file is allowed and none are ignored', async () => {
      const result = await getUploadableFileList(MOCK_SRC);

      expect(result).toEqual(MOCK_FILES);
    });

    it('should exclude files with disallowed extensions', async () => {
      mockedIsAllowedExtension.mockImplementation(
        file => !file.endsWith('.css')
      );

      const result = await getUploadableFileList(MOCK_SRC);

      expect(result).toEqual([MOCK_FILES[0], MOCK_FILES[1]]);
    });

    it('should exclude files rejected by the ignore filter', async () => {
      mockedCreateIgnoreFilter.mockReturnValue(
        file => file !== '/path/to/src/template.html'
      );

      const result = await getUploadableFileList(MOCK_SRC);

      expect(result).toEqual([MOCK_FILES[1], MOCK_FILES[2]]);
    });

    it('should create the ignore filter without the cwd override', async () => {
      await getUploadableFileList(MOCK_SRC);

      expect(mockedCreateIgnoreFilter).toHaveBeenCalledWith(false);
    });

    it('should log the error and return an empty list when walking fails', async () => {
      const error = new Error('walk failed');
      mockedWalk.mockRejectedValue(error);

      const result = await getUploadableFileList(MOCK_SRC);

      expect(mockedLogError).toHaveBeenCalledWith(error);
      expect(result).toEqual([]);
    });

    it('should not check for convertable fields when convertFields is not set', async () => {
      await getUploadableFileList(MOCK_SRC);

      expect(mockedIsConvertableFieldJs).not.toHaveBeenCalled();
      expect(mockedFieldsJsPrompt).not.toHaveBeenCalled();
    });

    describe('when convertFields is true', () => {
      const FIELDS_JS = '/path/to/src/module.module/fields.js';
      const FIELDS_JSON = '/path/to/src/module.module/fields.json';

      it('should return all files when none are field files', async () => {
        const result = await getUploadableFileList(MOCK_SRC, true);

        expect(result).toEqual(MOCK_FILES);
        expect(mockedFieldsJsPrompt).not.toHaveBeenCalled();
      });

      it('should check each file for convertable fields with the source and flag', async () => {
        await getUploadableFileList(MOCK_SRC, true);

        MOCK_FILES.forEach(file => {
          expect(mockedIsConvertableFieldJs).toHaveBeenCalledWith(
            MOCK_SRC,
            file,
            true
          );
        });
      });

      it('should prompt when a file is a convertable fields JS file', async () => {
        mockedWalk.mockResolvedValue([FIELDS_JS]);
        mockedIsConvertableFieldJs.mockReturnValue(true);
        mockedFieldsJsPrompt.mockResolvedValue([FIELDS_JS, []]);

        await getUploadableFileList(MOCK_SRC, true);

        expect(mockedFieldsJsPrompt).toHaveBeenCalledWith(
          FIELDS_JS,
          MOCK_SRC,
          []
        );
      });

      it('should prompt when a file is named fields.json', async () => {
        mockedWalk.mockResolvedValue([FIELDS_JSON]);
        mockedFieldsJsPrompt.mockResolvedValue([FIELDS_JSON, []]);

        await getUploadableFileList(MOCK_SRC, true);

        expect(mockedFieldsJsPrompt).toHaveBeenCalledWith(
          FIELDS_JSON,
          MOCK_SRC,
          []
        );
      });

      it('should include the file when the user chooses it', async () => {
        mockedWalk.mockResolvedValue([FIELDS_JSON]);
        mockedFieldsJsPrompt.mockResolvedValue([FIELDS_JSON, []]);

        const result = await getUploadableFileList(MOCK_SRC, true);

        expect(result).toEqual([FIELDS_JSON]);
      });

      it('should exclude the file when the user chooses a different one', async () => {
        mockedWalk.mockResolvedValue([FIELDS_JS, FIELDS_JSON]);
        mockedIsConvertableFieldJs.mockImplementation(
          (_src, file) => file === FIELDS_JS
        );
        mockedFieldsJsPrompt.mockResolvedValue([FIELDS_JSON, [FIELDS_JSON]]);

        const result = await getUploadableFileList(MOCK_SRC, true);

        expect(result).toEqual([]);
      });

      it('should skip prompting for files returned in the skip list', async () => {
        mockedWalk.mockResolvedValue([FIELDS_JS, FIELDS_JSON]);
        mockedIsConvertableFieldJs.mockImplementation(
          (_src, file) => file === FIELDS_JS
        );
        mockedFieldsJsPrompt.mockResolvedValue([FIELDS_JS, [FIELDS_JSON]]);

        const result = await getUploadableFileList(MOCK_SRC, true);

        expect(mockedFieldsJsPrompt).toHaveBeenCalledTimes(1);
        expect(result).toEqual([FIELDS_JS]);
      });

      it('should pass the updated skip list to subsequent prompts', async () => {
        const otherFieldsJson = '/path/to/src/other.module/fields.json';
        mockedWalk.mockResolvedValue([FIELDS_JSON, otherFieldsJson]);
        mockedFieldsJsPrompt
          .mockResolvedValueOnce([FIELDS_JSON, ['/some/skipped/file']])
          .mockResolvedValueOnce([otherFieldsJson, []]);

        await getUploadableFileList(MOCK_SRC, true);

        expect(mockedFieldsJsPrompt).toHaveBeenNthCalledWith(
          2,
          otherFieldsJson,
          MOCK_SRC,
          ['/some/skipped/file']
        );
      });
    });
  });
});
