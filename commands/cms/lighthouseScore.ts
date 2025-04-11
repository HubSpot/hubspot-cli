// @ts-nocheck
const SpinniesManager = require('../../lib/ui/SpinniesManager');
const {
  addAccountOptions,
  addConfigOptions,
  addUseEnvironmentOptions,
} = require('../../lib/commonOpts');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { getTableContents, getTableHeader } = require('../../lib/ui/table');
const { promptUser } = require('../../lib/prompts/promptUtils');
const { i18n } = require('../../lib/lang');
const { fetchThemes } = require('@hubspot/local-dev-lib/api/designManager');
const {
  requestLighthouseScore,
  getLighthouseScoreStatus,
  getLighthouseScore,
} = require('@hubspot/local-dev-lib/api/lighthouseScore');
const { HUBSPOT_FOLDER, MARKETPLACE_FOLDER } = require('../../lib/constants');
const { uiLink } = require('../../lib/ui');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

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
      message: i18n(
        `commands.cms.subcommands.lighthouseScore.info.promptMessage`
      ),
      choices: async () => {
        try {
          const { data: result } = await fetchThemes(accountId, {
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
          logger.error(
            i18n(
              `commands.cms.subcommands.lighthouseScore.errors.failedToFetchThemes`
            )
          );
          process.exit(EXIT_CODES.ERROR);
        }
      },
    },
  ]);

  return selectedTheme;
};

exports.handler = async options => {
  const { target, verbose, theme, derivedAccountId } = options;

  const includeDesktopScore = target === 'desktop' || !verbose;
  const includeMobileScore = target === 'mobile' || !verbose;
  let themeToCheck = theme;

  if (themeToCheck) {
    let isValidTheme = true;
    try {
      const { data: result } = await fetchThemes(derivedAccountId, {
        name: encodeURIComponent(themeToCheck),
      });
      isValidTheme = result && result.total;
    } catch (err) {
      isValidTheme = false;
    }
    if (!isValidTheme) {
      logger.error(
        i18n(`commands.cms.subcommands.lighthouseScore.errors.themeNotFound`, {
          theme: themeToCheck,
        })
      );
      process.exit(EXIT_CODES.ERROR);
    }
  } else {
    themeToCheck = await selectTheme(derivedAccountId);
    logger.log();
  }

  // Kick off the scoring
  let requestResult;
  try {
    const { data } = await requestLighthouseScore(derivedAccountId, {
      themePath: themeToCheck,
    });
    requestResult = data;
  } catch (err) {
    logger.debug(err);
  }

  if (!requestResult || !requestResult.mobileId || !requestResult.desktopId) {
    logger.error(
      i18n(
        `commands.cms.subcommands.lighthouseScore.errors.failedToGetLighthouseScore`
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }

  // Poll till scoring is finished
  try {
    SpinniesManager.init();

    SpinniesManager.add('lighthouseScore', {
      text: i18n(
        `commands.cms.subcommands.lighthouseScore.info.generatingScore`,
        { theme: themeToCheck }
      ),
    });

    const checkScoreStatus = async () => {
      let desktopScoreStatus = 'COMPLETED';
      if (includeDesktopScore) {
        const { data } = await getLighthouseScoreStatus(derivedAccountId, {
          themeId: requestResult.desktopId,
        });
        desktopScoreStatus = data;
      }

      let mobileScoreStatus = 'COMPLETED';
      if (includeDesktopScore) {
        const { data } = await getLighthouseScoreStatus(derivedAccountId, {
          themeId: requestResult.mobileId,
        });
        mobileScoreStatus = data;
      }

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
  let desktopScoreResult = {};
  let mobileScoreResult = {};
  let verboseViewAverageScoreResult = {};
  try {
    const params = { isAverage: !verbose };

    if (includeDesktopScore) {
      const { data } = await getLighthouseScore(derivedAccountId, {
        ...params,
        desktopId: requestResult.desktopId,
      });
      desktopScoreResult = data;
    }

    if (includeMobileScore) {
      const { data } = await getLighthouseScore(derivedAccountId, {
        ...params,
        mobileId: requestResult.mobileId,
      });
      mobileScoreResult = data;
    }
    // This is needed to show the average scores above the verbose output
    if (verbose) {
      const { data } = await getLighthouseScore(derivedAccountId, {
        ...params,
        isAverage: true,
        desktopId: includeDesktopScore ? requestResult.desktopId : null,
        mobileId: includeMobileScore ? requestResult.mobileId : null,
      });
      verboseViewAverageScoreResult = data;
    }
  } catch (err) {
    logger.error(
      i18n(
        `commands.cms.subcommands.lighthouseScore.errors.failedToGetLighthouseScore`
      )
    );
    process.exit(EXIT_CODES.ERROR);
  }

  if (verbose) {
    logger.log(`${themeToCheck} ${target} scores`);

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
    logger.log(
      i18n(
        `commands.cms.subcommands.lighthouseScore.info.pageTemplateScoreTitle`
      )
    );

    const table2Header = getTableHeader([
      'Template path',
      ...DEFAULT_TABLE_HEADER,
    ]);

    const scoreResult =
      target === 'desktop' ? desktopScoreResult : mobileScoreResult;

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

    logger.log(
      i18n(`commands.cms.subcommands.lighthouseScore.info.lighthouseLinksTitle`)
    );

    scoreResult.scores.forEach(score => {
      logger.log(' ', uiLink(score.templatePath, score.link));
    });

    if (scoreResult.failedTemplatePaths.length) {
      logger.log();
      logger.error(
        i18n(
          `commands.cms.subcommands.lighthouseScore.info.failedTemplatePathsTitle`
        )
      );
      scoreResult.failedTemplatePaths.forEach(failedTemplatePath => {
        logger.log(' ', failedTemplatePath);
      });
    }

    logger.log();
    logger.info(
      i18n(`commands.cms.subcommands.lighthouseScore.info.targetDeviceNote`, {
        target,
      })
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

    logger.info(
      i18n(`commands.cms.subcommands.lighthouseScore.info.verboseOptionNote`)
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
    describe: i18n(
      `commands.cms.subcommands.lighthouseScore.options.theme.describe`
    ),
    type: 'string',
  });
  yargs.option('target', {
    describe: i18n(
      `commands.cms.subcommands.lighthouseScore.options.target.describe`
    ),
    type: 'string',
    choices: ['desktop', 'mobile'],
    default: 'desktop',
  });
  yargs.option('verbose', {
    describe: i18n(
      `commands.cms.subcommands.lighthouseScore.options.verbose.describe`
    ),
    boolean: true,
    default: false,
  });
  yargs.example([
    [
      '$0 cms lighthouse-score --theme=my-theme',
      i18n(`commands.cms.subcommands.lighthouseScore.examples.default`),
    ],
  ]);

  addConfigOptions(yargs);
  addAccountOptions(yargs);
  addUseEnvironmentOptions(yargs);

  return yargs;
};
