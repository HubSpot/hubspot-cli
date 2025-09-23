import path from 'path';
import { walk } from '@hubspot/local-dev-lib/fs';
import { createIgnoreFilter } from '@hubspot/local-dev-lib/ignoreRules';
import { isConvertableFieldJs } from '@hubspot/local-dev-lib/cms/handleFieldsJS';
import { isAllowedExtension } from '@hubspot/local-dev-lib/path';

import { fieldsJsPrompt } from './prompts/cmsFieldPrompt.js';
import { logError } from './errorHandlers/index.js';

/*
 * Walks the src folder for files, filters them based on ignore filter.
 * If convertFields is true then will check for any JS fields conflicts (i.e., JS fields file and fields.json file) and prompt to resolve
 */
export async function getUploadableFileList(
  src: string,
  convertFields?: boolean
): Promise<string[]> {
  let filePaths: string[] = [];
  try {
    filePaths = await walk(src);
  } catch (e) {
    logError(e);
  }
  const allowedFiles = filePaths
    .filter(file => {
      if (!isAllowedExtension(file)) {
        return false;
      }
      return true;
    })
    .filter(createIgnoreFilter(false));
  if (!convertFields) {
    return allowedFiles;
  }

  const uploadableFiles = [];
  let skipFiles: string[] = [];
  for (const filePath of allowedFiles) {
    const fileName = path.basename(filePath);
    if (skipFiles.includes(filePath)) continue;
    const isConvertable = isConvertableFieldJs(src, filePath, convertFields);
    if (isConvertable || fileName == 'fields.json') {
      // This prompt checks if there are multiple field files in the folder and gets user to choose.
      const [choice, updatedSkipFiles] = await fieldsJsPrompt(
        filePath,
        src,
        skipFiles
      );
      skipFiles = updatedSkipFiles;
      // If they chose something other than the current file, move on.
      if (choice !== filePath) continue;
    }
    uploadableFiles.push(filePath);
  }
  return uploadableFiles;
}
