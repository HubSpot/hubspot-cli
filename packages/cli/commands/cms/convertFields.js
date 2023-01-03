const path = require('path');
const fs = require('fs');
const { createIgnoreFilter } = require('@hubspot/cli-lib/ignoreRules');
const { isAllowedExtension, getCwd } = require('@hubspot/cli-lib/path');
const { logger } = require('@hubspot/cli-lib/logger');
const { walk } = require('@hubspot/cli-lib/lib/walk');
const { getThemeJSONPath } = require('@hubspot/cli-lib/lib/files');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const {
  FieldsJs,
  isConvertableFieldJs,
} = require('@hubspot/cli-lib/lib/handleFieldsJs');

const { trackConvertFieldsUsage } = require('../../lib/usageTracking');
const i18nKey = 'cli.commands.convertFields';

exports.command = 'convert-fields';
exports.describe = i18n(`${i18nKey}.describe`);

const invalidPath = src => {
  logger.error(
    i18n(`${i18nKey}.errors.invalidPath`, {
      path: src,
    })
  );
};

exports.handler = async options => {
  const src = path.resolve(getCwd(), options.src);
  const themeJSONPath = getThemeJSONPath(src);
  const projectRoot = themeJSONPath
    ? path.dirname(themeJSONPath)
    : path.dirname(getCwd());
  let stats;
  try {
    stats = fs.statSync(src);
    if (!stats.isFile() && !stats.isDirectory()) {
      invalidPath(src);
      return;
    }
  } catch (e) {
    invalidPath(src);
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
    const filePaths = await walk(src);
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
  yargs.positional('src', {
    describe: i18n(`${i18nKey}.positionals.src.describe`),
    type: 'string',
  });
  yargs.option('fieldOptions', {
    describe: i18n(`${i18nKey}.options.options.describe`),
    type: 'array',
    default: [''],
  });
  return yargs;
};
