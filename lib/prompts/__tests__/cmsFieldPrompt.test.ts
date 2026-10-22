import fs from 'fs';
import path from 'path';
import { fieldsJsPrompt } from '../cmsFieldPrompt.js';
import { promptUser } from '../promptUtils.js';
import { lib } from '../../../lang/en.js';

vi.mock('fs');
vi.mock('../promptUtils');

const mockedReaddirSync = vi.mocked(fs.readdirSync);
const mockedPromptUser = vi.mocked(promptUser);

const MODULE_DIR = '/home/user/project/src/my.module';
const MODULE_FILE = `${MODULE_DIR}/module.html`;
const PROJECT_DIR = '/home/user/project';

function mockDirectoryContents(files: string[]): void {
  mockedReaddirSync.mockReturnValue(
    files as unknown as ReturnType<typeof fs.readdirSync>
  );
}

describe('lib/prompts/cmsFieldPrompt', () => {
  describe('fieldsJsPrompt()', () => {
    it('should return the original file path when there are no fields files', async () => {
      mockDirectoryContents(['module.html', 'meta.json']);

      const result = await fieldsJsPrompt(MODULE_FILE, PROJECT_DIR);

      expect(result).toEqual([MODULE_FILE, []]);
      expect(mockedPromptUser).not.toHaveBeenCalled();
    });

    it('should return the only fields file without prompting', async () => {
      mockDirectoryContents(['module.html', 'fields.json']);

      const result = await fieldsJsPrompt(MODULE_FILE, PROJECT_DIR);

      expect(result).toEqual([path.resolve(MODULE_DIR, 'fields.json'), []]);
      expect(mockedPromptUser).not.toHaveBeenCalled();
    });

    it('should ignore fields files that were already skipped', async () => {
      mockDirectoryContents(['fields.json', 'fields.js']);

      const result = await fieldsJsPrompt(MODULE_FILE, PROJECT_DIR, [
        path.resolve(MODULE_DIR, 'fields.json'),
      ]);

      expect(result).toEqual([path.resolve(MODULE_DIR, 'fields.js'), []]);
      expect(mockedPromptUser).not.toHaveBeenCalled();
    });

    it('should prompt with every fields file when there are several', async () => {
      mockDirectoryContents(['fields.json', 'fields.js', 'fields.cjs']);
      mockedPromptUser.mockResolvedValue({
        filePathChoice: path.resolve(MODULE_DIR, 'fields.js'),
      });

      await fieldsJsPrompt(MODULE_FILE, PROJECT_DIR);

      expect(mockedPromptUser).toHaveBeenCalledWith([
        {
          message: lib.prompts.uploadPrompt.fieldsPrompt(
            '/project/src/my.module'
          ),
          type: 'list',
          name: 'filePathChoice',
          choices: [
            {
              name: '/project/src/my.module/fields.json',
              value: path.resolve(MODULE_DIR, 'fields.json'),
            },
            {
              name: '/project/src/my.module/fields.js',
              value: path.resolve(MODULE_DIR, 'fields.js'),
            },
            {
              name: '/project/src/my.module/fields.cjs',
              value: path.resolve(MODULE_DIR, 'fields.cjs'),
            },
          ],
        },
      ]);
    });

    it('should return the chosen file and the files that were not picked', async () => {
      mockDirectoryContents(['fields.json', 'fields.js', 'fields.mjs']);
      mockedPromptUser.mockResolvedValue({
        filePathChoice: path.resolve(MODULE_DIR, 'fields.js'),
      });

      const result = await fieldsJsPrompt(MODULE_FILE, PROJECT_DIR);

      expect(result).toEqual([
        path.resolve(MODULE_DIR, 'fields.js'),
        [
          path.resolve(MODULE_DIR, 'fields.json'),
          path.resolve(MODULE_DIR, 'fields.mjs'),
        ],
      ]);
    });

    it('should append the files that were not picked to the existing skip list', async () => {
      const previouslySkipped = '/home/user/project/src/other.module/fields.js';
      mockDirectoryContents(['fields.json', 'fields.js']);
      mockedPromptUser.mockResolvedValue({
        filePathChoice: path.resolve(MODULE_DIR, 'fields.json'),
      });

      const result = await fieldsJsPrompt(MODULE_FILE, PROJECT_DIR, [
        previouslySkipped,
      ]);

      expect(result).toEqual([
        path.resolve(MODULE_DIR, 'fields.json'),
        [previouslySkipped, path.resolve(MODULE_DIR, 'fields.js')],
      ]);
    });

    it('should only consider files in the directory of the provided file', async () => {
      mockDirectoryContents(['fields.json']);

      await fieldsJsPrompt(MODULE_FILE, PROJECT_DIR);

      expect(mockedReaddirSync).toHaveBeenCalledWith(MODULE_DIR);
    });
  });
});
