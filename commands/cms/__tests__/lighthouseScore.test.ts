import { fetchThemes } from '@hubspot/local-dev-lib/api/designManager';
import {
  requestLighthouseScore,
  getLighthouseScoreStatus,
  getLighthouseScore,
} from '@hubspot/local-dev-lib/api/lighthouseScore';
import lighthouseScoreCommand from '../lighthouseScore.js';
import { EXIT_CODES } from '../../../lib/enums/exitCodes.js';

vi.mock('@hubspot/local-dev-lib/api/designManager');
vi.mock('@hubspot/local-dev-lib/api/lighthouseScore');
vi.mock('../../../lib/ui/SpinniesManager');
vi.mock('../../../lib/prompts/promptUtils');
vi.mock('../../../ui/render');
vi.mock('../../../lib/yargs/makeWrappedYargsHandler', () => ({
  makeWrappedYargsHandler: (
    _name: string,
    handler: (...args: unknown[]) => unknown
  ) => handler,
}));

const mockedFetchThemes = vi.mocked(fetchThemes);
const mockedRequestLighthouseScore = vi.mocked(requestLighthouseScore);
const mockedGetLighthouseScoreStatus = vi.mocked(getLighthouseScoreStatus);
const mockedGetLighthouseScore = vi.mocked(getLighthouseScore);

const MOCK_THEME_PATH = 'my-theme';
const MOCK_DESKTOP_ID = 111;
const MOCK_MOBILE_ID = 222;

const mockScoreResponse = {
  data: {
    scores: [
      {
        accessibilityScore: 90,
        bestPracticesScore: 90,
        performanceScore: 90,
        pwaScore: 90,
        seoScore: 90,
        runWarnings: [],
        auditDetails: null,
        emulatedFormFactor: 'desktop',
        templatePath: 'templates/home.html',
        link: null,
      },
    ],
    failedTemplatePaths: [],
  },
};

describe('commands/cms/lighthouseScore', () => {
  describe('command', () => {
    it('should have the correct command structure', () => {
      expect(lighthouseScoreCommand.command).toEqual(
        'lighthouse-score [--theme]'
      );
    });
  });

  describe('handler', () => {
    const mockExit = vi.fn();
    const mockArgs = {
      derivedAccountId: 100,
      theme: MOCK_THEME_PATH,
      target: 'desktop',
      verbose: false,
      exit: mockExit,
    } as unknown as Parameters<typeof lighthouseScoreCommand.handler>[0];

    beforeEach(() => {
      mockedFetchThemes.mockResolvedValue({
        data: { objects: [{ theme: { path: MOCK_THEME_PATH } }] },
      } as unknown as Awaited<ReturnType<typeof fetchThemes>>);
      mockedRequestLighthouseScore.mockResolvedValue({
        data: { desktopId: MOCK_DESKTOP_ID, mobileId: MOCK_MOBILE_ID },
      } as unknown as Awaited<ReturnType<typeof requestLighthouseScore>>);
      mockedGetLighthouseScoreStatus.mockResolvedValue({
        data: 'COMPLETED',
      } as unknown as Awaited<ReturnType<typeof getLighthouseScoreStatus>>);
      mockedGetLighthouseScore.mockResolvedValue(
        mockScoreResponse as unknown as Awaited<
          ReturnType<typeof getLighthouseScore>
        >
      );
    });

    it('should poll both desktop and mobile status when not verbose', async () => {
      await lighthouseScoreCommand.handler(mockArgs);

      expect(mockedGetLighthouseScoreStatus).toHaveBeenCalledTimes(2);
      expect(mockedGetLighthouseScoreStatus).toHaveBeenCalledWith(100, {
        themeId: MOCK_DESKTOP_ID,
      });
      expect(mockedGetLighthouseScoreStatus).toHaveBeenCalledWith(100, {
        themeId: MOCK_MOBILE_ID,
      });
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should only poll desktop status when verbose and target is desktop', async () => {
      await lighthouseScoreCommand.handler({
        ...mockArgs,
        verbose: true,
        target: 'desktop',
      });

      expect(mockedGetLighthouseScoreStatus).toHaveBeenCalledTimes(1);
      expect(mockedGetLighthouseScoreStatus).toHaveBeenCalledWith(100, {
        themeId: MOCK_DESKTOP_ID,
      });
      expect(mockedGetLighthouseScoreStatus).not.toHaveBeenCalledWith(100, {
        themeId: MOCK_MOBILE_ID,
      });
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    it('should only poll mobile status when verbose and target is mobile', async () => {
      await lighthouseScoreCommand.handler({
        ...mockArgs,
        verbose: true,
        target: 'mobile',
      });

      expect(mockedGetLighthouseScoreStatus).toHaveBeenCalledTimes(1);
      expect(mockedGetLighthouseScoreStatus).toHaveBeenCalledWith(100, {
        themeId: MOCK_MOBILE_ID,
      });
      expect(mockedGetLighthouseScoreStatus).not.toHaveBeenCalledWith(100, {
        themeId: MOCK_DESKTOP_ID,
      });
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should keep polling mobile status until it is no longer requested in a mobile-only run', async () => {
      vi.useFakeTimers();
      mockedGetLighthouseScoreStatus
        .mockResolvedValueOnce({ data: 'REQUESTED' } as unknown as Awaited<
          ReturnType<typeof getLighthouseScoreStatus>
        >)
        .mockResolvedValueOnce({ data: 'COMPLETED' } as unknown as Awaited<
          ReturnType<typeof getLighthouseScoreStatus>
        >);

      const handlerPromise = lighthouseScoreCommand.handler({
        ...mockArgs,
        verbose: true,
        target: 'mobile',
      });
      await vi.advanceTimersByTimeAsync(2000);
      await handlerPromise;

      expect(mockedGetLighthouseScoreStatus).toHaveBeenCalledTimes(2);
      expect(mockedGetLighthouseScore).toHaveBeenCalled();
      expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
    });
  });
});
