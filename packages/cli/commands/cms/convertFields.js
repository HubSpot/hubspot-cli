const path = require('path');
const fs = require('fs');
const { createIgnoreFilter } = require('@hubspot/local-dev-lib/ignoreRules');
const { isAllowedExtension, getCwd } = require('@hubspot/local-dev-lib/path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { walk } = require('@hubspot/local-dev-lib/fs');
const { getThemeJSONPath } = require('@hubspot/local-dev-lib/cms/themes');
const { i18n } = require('../../lib/lang');
const {
  FieldsJs,
  isConvertableFieldJs,
} = require('@hubspot/local-dev-lib/cms/handleFieldsJS');

const { trackConvertFieldsUsage } = require('../../lib/usageTracking');
const { logErrorInstance } = require('../../lib/errorHandlers/standardErrors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');
const i18nKey = 'commands.convertFields';

exports.command = 'convert-fields';
exports.describe = i18n(`${i18nKey}.describe`);

const invalidPath = src => {
  logger.error(
    i18n(`${i18nKey}.errors.invalidPath`, {
      path: src,
    })
  );
  process.exit(EXIT_CODES.ERROR);
};

exports.handler = async options => {
  let stats;
  let projectRoot;
  let src;

  try {
    src = path.resolve(getCwd(), options.src);
    const themeJSONPath = getThemeJSONPath(options.src);
    projectRoot = themeJSONPath
      ? path.dirname(themeJSONPath)
      : path.dirname(getCwd());
    stats = fs.statSync(src);
    if (!stats.isFile() && !stats.isDirectory()) {
      invalidPath(options.src);
      return;
    }
  } catch (e) {
    invalidPath(options.src);
  }

  trackConvertFieldsUsage('process');

  if (stats.isFile()) {
    const fieldsJs = await new FieldsJs(
      projectRoot,
      src,
      undefined,
      options.fieldOptions
    ).init();
    if (fieldsJs.rejected) return;
    fieldsJs.saveOutput();
  } else if (stats.isDirectory()) {
    let filePaths = [];
    try {
      filePaths = await walk(src);
    } catch (e) {
      logErrorInstance(e);
    }
    const allowedFilePaths = filePaths
      .filter(file => {
        if (!isAllowedExtension(file)) {
          return false;
        }
        return true;
      })
      .filter(createIgnoreFilter());
    for (const filePath of allowedFilePaths) {
      if (isConvertableFieldJs(projectRoot, filePath, true)) {
        const fieldsJs = await new FieldsJs(
          projectRoot,
          filePath,
          undefined,
          options.fieldOptions
        ).init();
        if (fieldsJs.rejected) return;
        fieldsJs.saveOutput();
      }
    }
  }
};

exports.builder = yargs => {
  yargs.option('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
    demandOption: true,
  });
  yargs.option('fieldOptions', {
    describe: i18n(`${i18nKey}.options.options.describe`),
    type: 'array',
    default: [''],
  });
  return yargs;
};
