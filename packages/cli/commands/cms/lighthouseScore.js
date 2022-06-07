const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
  getAccountId,
} = require('../../lib/commonOpts');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  getTableContents,
  getTableHeader,
} = require('@hubspot/cli-lib/lib/table');
const { loadAndValidateOptions } = require('../../lib/validation');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { i18n } = require('@hubspot/cli-lib/lib/lang');
const { fetchThemes } = require('@hubspot/cli-lib/api/designManager');
//const { getLighthouseScore } = require('@hubspot/cli-lib/api/lighthouse');
const {
  HUBSPOT_FOLDER,
  MARKETPLACE_FOLDER,
} = require('@hubspot/cli-lib/lib/constants');
const { uiLink } = require('../../lib/ui');

const i18nKey = 'cli.commands.cms.subcommands.lighthouseScore';

exports.command = 'lighthouse-score';
exports.describe = i18n(`${i18nKey}.describe`);

const selectTheme = async accountId => {
  const { default: selectedDefault } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'theme',
      message: i18n(`${i18nKey}.promptMessage`),
      choices: async () => {
        const result = await fetchThemes(accountId);
        if (result && result.objects) {
          return result.objects
            .map(({ theme }) => theme.path)
            .filter(
              themePath =>
                !themePath.startsWith(HUBSPOT_FOLDER) &&
                !themePath.startsWith(MARKETPLACE_FOLDER)
            );
        }
        logger.log('Failed to fetch themes');
        process.exit();
      },
    },
  ]);

  return selectedDefault;
};

exports.handler = async options => {
  await loadAndValidateOptions(options);
  const accountId = getAccountId(options);

  let themeToCheck = options.theme;

  if (!themeToCheck) {
    themeToCheck = await selectTheme(accountId);
  }

  //const scoreResult = await getLighthouseScore(accountId);

  logger.log('Page Template Scores');
  logger.log();

  const logsInfo1 = [
    '../about.html',
    93,
    93,
    83,
    21,
    59,
    'www.some-lighthouse-url.com',
  ];
  const logsInfo2 = [
    '.some/long/path/to/a/template/about.html',
    1,
    93,
    20,
    21,
    59,
    'www.some-lighthouse-url.com',
  ];
  const logsInfo3 = [
    './some/really-long-template-name.html',
    93,
    23,
    83,
    45,
    99,
    'www.some-lighthouse-url.com',
  ];
  const tableHeader = getTableHeader([
    'Template',
    'Accessibility',
    'Best practices',
    'Performace',
    'PWA',
    'SEO',
    'Lighthouse link',
  ]);

  logger.log(
    getTableContents([tableHeader, logsInfo1, logsInfo2, logsInfo3], {
      border: { bodyLeft: '  ' },
    })
  );
  logger.log();
  logger.log(
    `See ${uiLink(
      'Google Lighthouse',
      'https://www.webpagetest.org/lighthouse'
    )} for template scoring methodology.`
  );
  process.exit();
};

exports.builder = yargs => {
  yargs.option('theme', {
    describe: i18n(`${i18nKey}.options.theme.describe`),
    type: 'string',
  });
  yargs.example([
    [
      '$0 cms lighthouse-score --theme=my-theme',
      i18n(`${i18nKey}.examples.default`),
    ],
  ]);

  addConfigOptions(yargs, true);
  addAccountOptions(yargs, true);
  addUseEnvironmentOptions(yargs, true);

  return yargs;
};
