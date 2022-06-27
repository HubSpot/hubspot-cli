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

const DEFAULT_TABLE_HEADER = [
  'Accessibility',
  'Best practices',
  'Performace',
  'PWA',
  'SEO',
];

const PLACEHOLDER_TABLE_DATA = [
  '../about.html',
  93,
  93,
  83,
  21,
  59,
  'https://googlechrome.github.io/lighthouse/viewer/?psiurl=https%3A%2F%2Fwww.hubspot.com%2F&strategy=mobile&category=performance&category=accessibility&category=best-practices&category=seo&category=pwa&utm_source=lh-chrome-ext',
];

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

  // Validate options
  // TODO are there any other option combinations that we want to validate?
  if (options.detailed) {
    if (!options.target) {
      logger.error('[--target] is required for detailed view');
    }
  }

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

  themeToCheck = options.theme;
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
    logger.error('failed to request lighthouse score: ', err);
    process.exit(EXIT_CODES.ERROR);
  }

  // TODO: Should we write desktopId and mobileId to local storage, for the --detail option

  // Poll till scoring is finished
  try {
    let scoringCompleted = false;

    const spinnies = new Spinnies();

    spinnies.add('lighthouseScore', {
      text: `Generating lighthouse score for ${themeToCheck}`,
    });

    while (!scoringCompleted) {
      const desktopScoreStatus = await getLighthouseScoreStatus(accountId, {
        themeId: requestResult.desktopId,
      });
      const mobileScoreStatus = await getLighthouseScoreStatus(accountId, {
        themeId: requestResult.mobileId,
      });
      logger.log('Request statuses: ', desktopScoreStatus, mobileScoreStatus);
      if (
        desktopScoreStatus.status === 'COMPLETED' &&
        mobileScoreStatus.status === 'COMPLETED'
      ) {
        scoringCompleted = true;
      } else if (
        desktopScoreStatus.status !== 'REQUESTED' &&
        mobileScoreStatus.status !== 'REQUESTED'
      ) {
        logger.log(
          'Lighthouse scoring failed: ',
          desktopScoreStatus,
          mobileScoreStatus
        );
        break;
      }

      // TODO: We can sleep here for like 2 seconds
    }
    spinnies.remove('lighthouseScore');
  } catch (err) {
    logger.error('error getting status: ', err.statusCode);
    process.exit(EXIT_CODES.ERROR);
  }

  // Fetch the scoring results
  let scoreResult;
  try {
    const isDesktop = options.target === 'desktop';
    const params = {
      isAverage: !options.detailed,
      desktopId: isDesktop ? requestResult.desktopId : null,
      mobileId: isDesktop ? null : requestResult.mobileId,
      emulatedFormFactor: options.target ? options.target.toUpperCase() : null,
      onlyLinks: options.linksOnly,
    };
    scoreResult = await getLighthouseScoreAverage(accountId, params);
    logger.log(scoreResult);
  } catch (err) {
    logger.error('error getting final score: ', err.statusCode);
    process.exit(EXIT_CODES.ERROR);
  }

  // TODO handle linksOnly output and also errors

  if (options.detailed) {
    logger.log(`${themeToCheck} theme ${options.target} scores`);
    const tableHeader = getTableHeader(DEFAULT_TABLE_HEADER);

    // TODO create a row for the average (using whichever target was specified) and replace placeholder data

    logger.log(
      getTableContents([tableHeader, PLACEHOLDER_TABLE_DATA], {
        border: { bodyLeft: '  ' },
      })
    );
    logger.log('Page template scores');
    const table2Header = getTableHeader([
      'Template path',
      ...DEFAULT_TABLE_HEADER,
    ]);

    // TODO create rows for individual template scores and replace placeholder data

    logger.log(
      getTableContents([table2Header, PLACEHOLDER_TABLE_DATA], {
        border: { bodyLeft: '  ' },
      })
    );

    logger.log(`Note: Scores are being shown for ${options.target} only.`);
  } else {
    logger.log(`Theme: ${themeToCheck} `);
    const tableHeader = getTableHeader(['Target', ...DEFAULT_TABLE_HEADER]);

    // TODO create rows for desktop score + mobile score and replace placeholder data

    logger.log(
      getTableContents([tableHeader, PLACEHOLDER_TABLE_DATA], {
        border: { bodyLeft: '  ' },
      })
    );

    logger.log(
      'Note: Theme scores are averages of all theme templates. Use "hs cms lighthouse-score-detail" for template scores.'
    );
  }

  // TODO fix the link
  logger.log(
    `Powered by ${uiLink(
      'Google Lighthouse',
      'https://www.webpagetest.org/lighthouse'
    )}.`
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
  });
  yargs.option('detailed', {
    describe: i18n(`${i18nKey}.options.detailed.describe`),
    boolean: true,
    default: false,
  });
  yargs.option('linksOnly', {
    describe: i18n(`${i18nKey}.options.linksOnly.describe`),
    boolean: true,
    default: false,
  });
  yargs.conflicts('detailed', 'target');
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
