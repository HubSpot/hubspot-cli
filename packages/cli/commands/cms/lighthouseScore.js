//const chalk = require('chalk');
const Spinnies = require('spinnies');
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
const {
  requestLighthouseScore,
  getLighthouseScoreStatus,
  getLighthouseScoreAverage,
  //getLighthouseScoreDetailed,
} = require('@hubspot/cli-lib/api/lighthouseScore');
const {
  HUBSPOT_FOLDER,
  MARKETPLACE_FOLDER,
} = require('@hubspot/cli-lib/lib/constants');
const { uiLink } = require('../../lib/ui');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const i18nKey = 'cli.commands.cms.subcommands.lighthouseScore';

exports.command = 'lighthouse-score [--theme]';
exports.describe = i18n(`${i18nKey}.describe`);

const selectTheme = async availableThemes => {
  const { theme: selectedTheme } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'theme',
      message: i18n(`${i18nKey}.promptMessage`),
      choices: availableThemes,
    },
  ]);

  return selectedTheme;
};

exports.handler = async options => {
  await loadAndValidateOptions(options);
  const accountId = getAccountId(options);

  let themeToCheck = options.theme;
  let availableThemes;

  try {
    const result = await fetchThemes(accountId);
    if (result && result.objects) {
      availableThemes = result.objects
        .map(({ theme }) => theme.path)
        .filter(
          themePath =>
            !themePath.startsWith(HUBSPOT_FOLDER) &&
            !themePath.startsWith(MARKETPLACE_FOLDER)
        );
    }
  } catch (err) {
    logger.log('Failed to fetch available themes');
  }

  if (themeToCheck) {
    // Still attempt to run the scoring if the theme request fails
    const isValidTheme =
      !availableThemes || availableThemes.includes(themeToCheck);
    if (!isValidTheme) {
      logger.error(
        `Theme "${themeToCheck}" not found. Please rerun using a valid theme path.`
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    themeToCheck = await selectTheme(availableThemes);
  }

  let requestResult;

  // Kick off the scoring
  try {
    requestResult = await requestLighthouseScore(accountId, {
      themePath: themeToCheck,
    });
  } catch (err) {
    logger.error('failed to request lighthouse score: ', err.statusCode);
    process.exit(EXIT_CODES.ERROR);
  }

  // Poll till scoring is finished
  try {
    let scoringCompleted = false;

    const spinnies = new Spinnies();

    spinnies.add('lighthouseScore', {
      text: `Generating lighthouse score for ${themeToCheck}`,
    });

    while (!scoringCompleted) {
      const status = await getLighthouseScoreStatus(accountId, {
        themeId: themeToCheck,
      });
      logger.log('Request status', status);
      scoringCompleted = true;
    }

    spinnies.remove('lighthouseScore');
  } catch (err) {
    logger.error('error getting status: ', err.statusCode);
    process.exit(EXIT_CODES.ERROR);
  }

  // Fetch the scoring results
  try {
    const isDesktop = options.target === 'desktop';
    const params = {
      isAverage: !options.detailed,
      desktopId: isDesktop ? requestResult.desktopId : null,
      mobileId: isDesktop ? null : requestResult.mobileId,
      emulatedFormFactor: options.target.toUpperCase(),
    };
    const scoreResult = await getLighthouseScoreAverage(accountId, params);
    logger.log(scoreResult);
  } catch (err) {
    logger.error('error getting final score: ', err.statusCode);
    process.exit(EXIT_CODES.ERROR);
  }

  logger.log('Page Template Scores for: ', themeToCheck);
  logger.log();

  const logsInfo1 = [
    '../about.html',
    93,
    93,
    83,
    21,
    59,
    'https://googlechrome.github.io/lighthouse/viewer/?psiurl=https%3A%2F%2Fwww.hubspot.com%2F&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo&category=pwa&utm_source=lh-chrome-ext',
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
    getTableContents([tableHeader, logsInfo1], {
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
  yargs.option('target', {
    describe: i18n(`${i18nKey}.options.target.describe`),
    type: 'string',
    choices: ['desktop', 'mobile'],
    default: 'desktop',
  });
  yargs.option('detailed', {
    describe: i18n(`${i18nKey}.options.detailed.describe`),
    boolean: true,
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
