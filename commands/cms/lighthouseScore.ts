import { Argv, ArgumentsCamelCase } from 'yargs';
import SpinniesManager from '../../lib/ui/SpinniesManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import { getTableContents, getTableHeader } from '../../lib/ui/table';
import { promptUser } from '../../lib/prompts/promptUtils';
import { i18n } from '../../lib/lang';
import { fetchThemes } from '@hubspot/local-dev-lib/api/designManager';
import {
  requestLighthouseScore,
  getLighthouseScoreStatus,
  getLighthouseScore,
} from '@hubspot/local-dev-lib/api/lighthouseScore';
import {
  RequestLighthouseScoreResponse,
  GetLighthouseScoreResponse,
} from '@hubspot/local-dev-lib/types/Lighthouse';
import { HUBSPOT_FOLDER, MARKETPLACE_FOLDER } from '../../lib/constants';
import { uiLink } from '../../lib/ui';
import { EXIT_CODES } from '../../lib/enums/exitCodes';
import {
  AccountArgs,
  CommonArgs,
  EnvironmentArgs,
  YargsCommandModule,
} from '../../types/Yargs';
import { makeYargsBuilder } from '../../lib/yargsUtils';

const DEFAULT_TABLE_HEADER = [
  'Accessibility',
  'Best practices',
  'Performace',
  'PWA',
  'SEO',
];

const EMPTY_SCORE: GetLighthouseScoreResponse['scores'][0] = {
  accessibilityScore: 0,
  bestPracticesScore: 0,
  performanceScore: 0,
  pwaScore: 0,
  seoScore: 0,
  runWarnings: [],
  auditDetails: null,
  emulatedFormFactor: '',
  templatePath: null,
  link: null,
};

const command = 'lighthouse-score [--theme]';
const describe = undefined;

type LighthouseScoreArgs = CommonArgs &
  AccountArgs &
  EnvironmentArgs & { theme?: string; target: string; verbose: boolean };

async function selectTheme(accountId: number): Promise<string> {
  let themes: string[] = [];
  try {
    const { data: result } = await fetchThemes(accountId, {
      limit: 500,
      sorting: 'MOST_USED',
    });
    if (result && result.objects) {
      themes = result.objects
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

  const { theme: selectedTheme } = await promptUser([
    {
      type: 'list',
      name: 'theme',
      message: i18n(
        `commands.cms.subcommands.lighthouseScore.info.promptMessage`
      ),
      choices: themes,
    },
  ]);

  return selectedTheme;
}

async function handler(args: ArgumentsCamelCase<LighthouseScoreArgs>) {
  const { target, verbose, theme, derivedAccountId } = args;

  const includeDesktopScore = target === 'desktop' || !verbose;
  const includeMobileScore = target === 'mobile' || !verbose;
  let themeToCheck = theme;

  if (themeToCheck) {
    let isValidTheme = true;
    try {
      const { data: result } = await fetchThemes(derivedAccountId, {
        name: encodeURIComponent(themeToCheck),
      });
      isValidTheme = result && !!result.total;
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
  let requestResult: RequestLighthouseScoreResponse | undefined;

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
  let desktopScoreResult: GetLighthouseScoreResponse | undefined;
  let mobileScoreResult: GetLighthouseScoreResponse | undefined;
  let verboseViewAverageScoreResult: GetLighthouseScoreResponse | undefined;
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
        desktopId: includeDesktopScore ? requestResult.desktopId : undefined,
        mobileId: includeMobileScore ? requestResult.mobileId : undefined,
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
    const scoreResult =
      target === 'desktop' ? desktopScoreResult : mobileScoreResult;

    if (!verboseViewAverageScoreResult || !scoreResult) {
      logger.error(
        i18n(
          `commands.cms.subcommands.lighthouseScore.errors.failedToGetLighthouseScore`
        )
      );
      process.exit(EXIT_CODES.ERROR);
    }

    logger.log(`${themeToCheck} ${target} scores`);

    const tableHeader = getTableHeader(DEFAULT_TABLE_HEADER);

    const scores = verboseViewAverageScoreResult.scores
      ? verboseViewAverageScoreResult.scores[0]
      : EMPTY_SCORE;

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
      if (score.templatePath && score.link) {
        logger.log(' ', uiLink(score.templatePath, score.link));
      }
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

    const getTableData = (
      target: string,
      scoreResult?: GetLighthouseScoreResponse
    ): [string, number, number, number, number, number] => {
      const scores = scoreResult?.scores ? scoreResult.scores[0] : EMPTY_SCORE;
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

  process.exit(EXIT_CODES.SUCCESS);
}

function cmslighthouseScoreBuilder(yargs: Argv): Argv<LighthouseScoreArgs> {
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

  return yargs as Argv<LighthouseScoreArgs>;
}

const builder = makeYargsBuilder<LighthouseScoreArgs>(
  cmslighthouseScoreBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
    useConfigOptions: true,
    useAccountOptions: true,
    useEnvironmentOptions: true,
  }
);

const cmslighthouseScoreCommand: YargsCommandModule<
  unknown,
  LighthouseScoreArgs
> = {
  command,
  describe,
  handler,
  builder,
};

export default cmslighthouseScoreCommand;

// TODO remove this after cms.ts is ported to TypeScript
module.exports = cmslighthouseScoreCommand;
