const path = require('path');
const { walk } = require('@hubspot/cli-lib/lib/walk');
const { createIgnoreFilter } = require('@hubspot/cli-lib/ignoreRules');
const { fieldsJsPrompt } = require('../lib/prompts/cmsFieldPrompt');
const {
  isAllowedExtension,
  splitHubSpotPath,
} = require('@hubspot/cli-lib/path');
const { isConvertableFieldJs } = require('@hubspot/cli-lib/lib/handleFieldsJs');
const { doRemoteWalk } = require('@hubspot/cli-lib/fileMapper');

/*
 * Walks the src folder for files, filters them based on ignore filter.
 * If convertFields is true then will check for any JS fields conflicts (i.e., JS fields file and fields.json file) and prompt to resolve
 */
const getUploadableFileList = async (src, convertFields) => {
  const filePaths = await walk(src);
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

/*
 * Return any files that exist on the remote but not locally.
 */
const getDeletedFilesList = async (
  accountId,
  projectRoot,
  normalizedDest,
  filePaths
) => {
  const remoteFiles = await doRemoteWalk(accountId, normalizedDest);
  const remoteProjectRoot = splitHubSpotPath(normalizedDest).shift();
  const relLocalPaths = filePaths.map(filePath =>
    path.relative(projectRoot, filePath)
  );
  const relRemotePaths = remoteFiles.map(filePath =>
    path.relative(remoteProjectRoot, filePath)
  );
  const remoteAndNotLocal = relRemotePaths.filter(
    x => !relLocalPaths.includes(x)
  );
  return remoteAndNotLocal;
};

module.exports = {
  getUploadableFileList,
  getDeletedFilesList,
};
