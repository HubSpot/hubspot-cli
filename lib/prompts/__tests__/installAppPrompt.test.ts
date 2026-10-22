import open from 'open';
import {
  installAppAutoPrompt,
  installAppBrowserPrompt,
} from '../installAppPrompt.js';
import { promptUser } from '../promptUtils.js';
import { uiLogger } from '../../ui/logger.js';
import { PromptExitError } from '../../errors/PromptExitError.js';
import { EXIT_CODES } from '../../enums/exitCodes.js';
import { lib } from '../../../lang/en.js';

vi.mock('open');
vi.mock('../promptUtils');

const mockedOpen = vi.mocked(open);
const mockedPromptUser = vi.mocked(promptUser);

const INSTALL_URL = 'https://app.hubspot.com/install';

describe('lib/prompts/installAppPrompt', () => {
  describe('installAppBrowserPrompt()', () => {
    beforeEach(() => {
      mockedPromptUser.mockResolvedValue({ shouldOpenBrowser: true });
    });

    it('should log the install explanation and prompt for an install', async () => {
      await installAppBrowserPrompt(INSTALL_URL);

      expect(uiLogger.log).toHaveBeenCalledWith(
        lib.prompts.installAppPrompt.explanation
      );
      expect(mockedPromptUser).toHaveBeenCalledWith({
        name: 'shouldOpenBrowser',
        type: 'confirm',
        message: lib.prompts.installAppPrompt.prompt,
      });
    });

    it('should log the reinstall explanation and prompt for a reinstall when isReinstall is true', async () => {
      await installAppBrowserPrompt(INSTALL_URL, true);

      expect(uiLogger.log).toHaveBeenCalledWith(
        lib.prompts.installAppPrompt.reinstallExplanation
      );
      expect(uiLogger.log).not.toHaveBeenCalledWith(
        lib.prompts.installAppPrompt.explanation
      );
      expect(mockedPromptUser).toHaveBeenCalledWith({
        name: 'shouldOpenBrowser',
        type: 'confirm',
        message: lib.prompts.installAppPrompt.reinstallPrompt,
      });
    });

    it('should open the install url when the user accepts', async () => {
      await installAppBrowserPrompt(INSTALL_URL);

      expect(mockedOpen).toHaveBeenCalledWith(INSTALL_URL);
    });

    it('should open the install url when the user accepts a reinstall', async () => {
      await installAppBrowserPrompt(INSTALL_URL, true);

      expect(mockedOpen).toHaveBeenCalledWith(INSTALL_URL);
    });

    it('should throw a PromptExitError when the user declines the install', async () => {
      mockedPromptUser.mockResolvedValue({ shouldOpenBrowser: false });

      const promise = installAppBrowserPrompt(INSTALL_URL);

      await expect(promise).rejects.toThrow(PromptExitError);
      await expect(promise).rejects.toMatchObject({
        message: lib.prompts.installAppPrompt.decline,
        exitCode: EXIT_CODES.SUCCESS,
      });
      expect(uiLogger.log).toHaveBeenCalledWith(
        lib.prompts.installAppPrompt.decline
      );
      expect(mockedOpen).not.toHaveBeenCalled();
    });

    it('should return without opening the browser when the user declines a reinstall', async () => {
      mockedPromptUser.mockResolvedValue({ shouldOpenBrowser: false });

      await installAppBrowserPrompt(INSTALL_URL, true);

      expect(mockedOpen).not.toHaveBeenCalled();
      expect(uiLogger.log).not.toHaveBeenCalledWith(
        lib.prompts.installAppPrompt.decline
      );
    });
  });

  describe('installAppAutoPrompt()', () => {
    it('should return true when the user accepts', async () => {
      mockedPromptUser.mockResolvedValue({ shouldInstall: true });

      const result = await installAppAutoPrompt();

      expect(result).toBe(true);
    });

    it('should return false when the user declines', async () => {
      mockedPromptUser.mockResolvedValue({ shouldInstall: false });

      const result = await installAppAutoPrompt();

      expect(result).toBe(false);
    });

    it('should prompt with the auto install message', async () => {
      mockedPromptUser.mockResolvedValue({ shouldInstall: true });

      await installAppAutoPrompt();

      expect(mockedPromptUser).toHaveBeenCalledWith({
        name: 'shouldInstall',
        type: 'confirm',
        message: lib.prompts.installAppPrompt.autoPrompt,
      });
    });
  });
});
