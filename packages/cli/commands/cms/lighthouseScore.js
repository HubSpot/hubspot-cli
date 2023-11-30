const SpinniesManager = require('../../lib/SpinniesManager');
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
} = require('@hubspot/local-dev-lib/logging/table');
const { loadAndValidateOptions } = require('../../lib/validation');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { i18n } = require('../../lib/lang');
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
exports.describe = false; // i18n(`${i18nKey}.describe`);

const selectTheme = async accountId => {
  const { theme: selectedTheme } = await promptUser([
    {
      type: 'list',
      look: false,
      name: 'theme',
      message: i18n(`${i18nKey}.info.promptMessage`),
      choices: async () => {
        try {
          const result = await fetchThemes(accountId, {
            limit: 500,
            sorting: 'MOST_USED',
          });
          if (result && result.objects) {
            return result.objects
              .map(({ theme }) => theme.path)
              .filter(
                themePath =>
                  !themePath.startsWith(HUBSPOT_FOLDER) &&
                  !themePath.startsWith(MARKETPLACE_FOLDER)
              );
          }
        } catch (err) {
          logger.error(i18n(`${i18nKey}.errors.failedToFetchThemes`));
          process.exit(EXIT_CODES.ERROR);
        }
      },
    },
  ]);

  return selectedTheme;
};

exports.handler = async options => {
  await loadAndValidateOptions(options);
  const accountId = getAccountId(options);

  const includeDesktopScore = options.target === 'desktop' || !options.verbose;
  const includeMobileScore = options.target === 'mobile' || !options.verbose;
  let themeToCheck = options.theme;

  if (themeToCheck) {
    let isValidTheme = true;
    try {
      const result = await fetchThemes(accountId, {
        name: encodeURIComponent(themeToCheck),
      });
      isValidTheme = result && result.total;
    } catch (err) {
      isValidTheme = false;
    }
    if (!isValidTheme) {
      logger.error(
        i18n(`${i18nKey}.errors.themeNotFound`, { theme: themeToCheck })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    themeToCheck = await selectTheme(accountId);
    logger.log();
  }

  // Kick off the scoring
  let requestResult;
  try {
    requestResult = await requestLighthouseScore(accountId, {
      themePath: themeToCheck,
    });
  } catch (err) {
    logger.debug(err);
  }

  if (!requestResult || !requestResult.mobileId || !requestResult.desktopId) {
    logger.error(i18n(`${i18nKey}.errors.failedToGetLighthouseScore`));
    process.exit(EXIT_CODES.ERROR);
  }

  // Poll till scoring is finished
  try {
    SpinniesManager.init();

    SpinniesManager.add('lighthouseScore', {
      text: i18n(`${i18nKey}.info.generatingScore`, { theme: themeToCheck }),
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

    SpinniesManager.remove('lighthouseScore');
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }

  // Fetch the scoring results
  let desktopScoreResult;
  let mobileScoreResult;
  let verboseViewAverageScoreResult;
  try {
    const params = { isAverage: !options.verbose };
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
    // This is needed to show the average scores above the verbose output
    verboseViewAverageScoreResult = options.verbose
      ? await getLighthouseScore(accountId, {
          ...params,
          isAverage: true,
          desktopId: includeDesktopScore ? requestResult.desktopId : null,
          mobileId: includeMobileScore ? requestResult.mobileId : null,
        })
      : {};
  } catch (err) {
    logger.error(i18n(`${i18nKey}.errors.failedToGetLighthouseScore`));
    process.exit(EXIT_CODES.ERROR);
  }

  if (options.verbose) {
    logger.log(`${themeToCheck} ${options.target} scores`);

    const tableHeader = getTableHeader(DEFAULT_TABLE_HEADER);

    const scores = verboseViewAverageScoreResult.scores
      ? verboseViewAverageScoreResult.scores[0]
      : {};

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
    logger.log(i18n(`${i18nKey}.info.pageTemplateScoreTitle`));

    const table2Header = getTableHeader([
      'Template path',
      ...DEFAULT_TABLE_HEADER,
    ]);

    const scoreResult =
      options.target === 'desktop' ? desktopScoreResult : mobileScoreResult;

    const templateTableData = scoreResult.scores.map(score => {
      return [
        score.templatePath,
        score.accessibilityScore,
        score.bestPracticesScore,
        score.performanceScore,
        score.pwaScore,
        score.seoScore,
      ];
    });

    logger.log(
      getTableContents([table2Header, ...templateTableData], {
        border: { bodyLeft: '  ' },
      })
    );

    logger.log(i18n(`${i18nKey}.info.lighthouseLinksTitle`));

    scoreResult.scores.forEach(score => {
      logger.log(' ', uiLink(score.templatePath, score.link));
    });

    if (scoreResult.failedTemplatePaths.length) {
      logger.log();
      logger.error(i18n(`${i18nKey}.info.failedTemplatePathsTitle`));
      scoreResult.failedTemplatePaths.forEach(failedTemplatePath => {
        logger.log(' ', failedTemplatePath);
      });
    }

    logger.log();
    logger.info(
      i18n(`${i18nKey}.info.targetDeviceNote`, { target: options.target })
    );
  } else {
    logger.log(`Theme: ${themeToCheck}`);
    const tableHeader = getTableHeader(['Target', ...DEFAULT_TABLE_HEADER]);

    const getTableData = (target, scoreResult) => {
      const scores = scoreResult.scores ? scoreResult.scores[0] : {};
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

    logger.info(i18n(`${i18nKey}.info.verboseOptionNote`));
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
    default: 'desktop',
  });
  yargs.option('verbose', {
    describe: i18n(`${i18nKey}.options.verbose.describe`),
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
