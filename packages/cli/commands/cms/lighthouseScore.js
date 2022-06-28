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
  getLighthouseScore,
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
  if (options.detailed) {
    if (!options.target) {
      logger.error('[--target] is required for detailed view');
      process.exit(EXIT_CODES.ERROR);
    }
  } else if (options.target) {
    logger.error('[--target] can only be used for detailed view');
    process.exit(EXIT_CODES.ERROR);
  }

  const includeDesktopScore = options.target === 'desktop' || !options.detailed;
  const includeMobileScore = options.target === 'mobile' || !options.detailed;

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
    logger.log();
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

  if (!requestResult.mobileId || !requestResult.desktopId) {
    logger.log(
      'Failed to request lighthouse score. No desktopId or mobileId to poll'
    );
  }

  // Poll till scoring is finished
  try {
    const spinnies = new Spinnies();

    spinnies.add('lighthouseScore', {
      text: `Generating lighthouse score for ${themeToCheck}`,
    });

    const checkScoreStatus = async () => {
      const desktopScoreStatus = includeDesktopScore
        ? await getLighthouseScoreStatus(accountId, {
            themeId: requestResult.desktopId,
          })
        : 'COMPLETED';
      const mobileScoreStatus = includeMobileScore
        ? await getLighthouseScoreStatus(accountId, {
            themeId: requestResult.mobileId,
          })
        : 'COMPLETED';

      if (
        desktopScoreStatus === 'REQUESTED' ||
        mobileScoreStatus === 'REQUESTED'
      ) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        await checkScoreStatus();
      }
    };

    await checkScoreStatus();

    spinnies.remove('lighthouseScore');
  } catch (err) {
    logger.error('error getting status: ', err);
    process.exit(EXIT_CODES.ERROR);
  }

  // Fetch the scoring results
  let desktopScoreResult;
  let mobileScoreResult;
  let detailedViewAverageScoreResult;
  try {
    const params = {
      isAverage: !options.detailed,
      onlyLinks: options.linksOnly,
    };
    desktopScoreResult = includeDesktopScore
      ? await getLighthouseScore(accountId, {
          ...params,
          desktopId: requestResult.desktopId,
        })
      : {};
    mobileScoreResult = includeMobileScore
      ? await getLighthouseScore(accountId, {
          ...params,
          mobileId: requestResult.mobileId,
        })
      : {};
    detailedViewAverageScoreResult = options.detailed
      ? await getLighthouseScore(accountId, {
          ...params,
          isAverage: true,
          desktopId: includeDesktopScore ? requestResult.desktopId : null,
          mobileId: includeMobileScore ? requestResult.mobileId : null,
        })
      : {};
  } catch (err) {
    logger.error('error getting final score: ', err.statusCode);
    process.exit(EXIT_CODES.ERROR);
  }

  // TODO handle linksOnly output and also errors

  if (options.detailed) {
    logger.log(`${themeToCheck} ${options.target} scores`);
    const tableHeader = getTableHeader(DEFAULT_TABLE_HEADER);

    const scores = detailedViewAverageScoreResult.scores[''] || {};
    const averageTableData = [
      scores.accessibilityScore,
      scores.bestPracticesScore,
      scores.performanceScore,
      scores.pwaScore,
      scores.seoScore,
    ];

    logger.log(
      getTableContents([tableHeader, averageTableData], {
        border: { bodyLeft: '  ' },
      })
    );
    logger.log('Page template scores');
    const table2Header = getTableHeader([
      'Template path',
      ...DEFAULT_TABLE_HEADER,
    ]);

    const scoreResult =
      options.target === 'desktop' ? desktopScoreResult : mobileScoreResult;
    const templateTableData = Object.keys(scoreResult.scores).map(
      lighthouseLink => {
        const templateScore = scoreResult.scores[lighthouseLink];
        return [
          '/templatePath',
          templateScore.accessibilityScore,
          templateScore.bestPracticesScore,
          templateScore.performanceScore,
          templateScore.pwaScore,
          templateScore.seoScore,
        ];
      }
    );

    logger.log(
      getTableContents([table2Header, ...templateTableData], {
        border: { bodyLeft: '  ' },
      })
    );

    logger.log(`Note: Scores are being shown for ${options.target} only.`);
  } else {
    logger.log(`Theme: ${themeToCheck} `);
    const tableHeader = getTableHeader(['Target', ...DEFAULT_TABLE_HEADER]);

    const getTableData = (target, scoreResult) => {
      const scores = scoreResult.scores[''] || {};
      return [
        target,
        scores.accessibilityScore,
        scores.bestPracticesScore,
        scores.performanceScore,
        scores.pwaScore,
        scores.seoScore,
      ];
    };

    const tableData = [
      getTableData('desktop', desktopScoreResult),
      getTableData('mobile', mobileScoreResult),
    ];

    logger.log(
      getTableContents([tableHeader, ...tableData], {
        border: { bodyLeft: '  ' },
      })
    );

    logger.log(
      'Note: Theme scores are averages of all theme templates. Use "hs cms lighthouse-score-detail" for template scores.'
    );
  }

  logger.log();
  logger.log(
    `Powered by ${uiLink(
      'Google Lighthouse',
      'https://developer.chrome.com/docs/lighthouse/overview/'
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
