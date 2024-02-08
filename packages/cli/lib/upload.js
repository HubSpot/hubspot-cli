const path = require('path');
const { walk } = require('@hubspot/local-dev-lib/fs');
const { createIgnoreFilter } = require('@hubspot/local-dev-lib/ignoreRules');
const { fieldsJsPrompt } = require('../lib/prompts/cmsFieldPrompt');
const { isAllowedExtension } = require('@hubspot/local-dev-lib/path');
const { isConvertableFieldJs } = require('@hubspot/cli-lib/lib/handleFieldsJs');
const { logErrorInstance } = require('./errorHandlers/standardErrors');

/*
 * Walks the src folder for files, filters them based on ignore filter.
 * If convertFields is true then will check for any JS fields conflicts (i.e., JS fields file and fields.json file) and prompt to resolve
 */
const getUploadableFileList = async (src, convertFields) => {
  let filePaths = [];
  try {
    filePaths = await walk(src);
  } catch (e) {
    logErrorInstance(e);
  }
  const allowedFiles = filePaths
    .filter(file => {
      if (!isAllowedExtension(file)) {
        return false;
      }
      return true;
    })
    .filter(createIgnoreFilter());
  if (!convertFields) {
    return allowedFiles;
  }

  let uploadableFiles = [];
  let skipFiles = [];
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
};

module.exports = {
  getUploadableFileList,
};
