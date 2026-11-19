const { uiLogger } =
  await vi.importActual<typeof import('../logger.js')>('../logger.js');

const consoleErrorSpy = vi
  .spyOn(console, 'error')
  .mockImplementation(() => undefined);
const consoleInfoSpy = vi
  .spyOn(console, 'info')
  .mockImplementation(() => undefined);
const consoleLogSpy = vi
  .spyOn(console, 'log')
  .mockImplementation(() => undefined);

const MOCK_MESSAGE = 'Run hs example';

describe('lib/ui/logger', () => {
  describe('uiLogger', () => {
    describe('hint()', () => {
      it('should write the message to stderr', () => {
        uiLogger.hint(MOCK_MESSAGE);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(MOCK_MESSAGE)
        );
      });

      it('should not write to stdout', () => {
        uiLogger.hint(MOCK_MESSAGE);

        expect(consoleInfoSpy).not.toHaveBeenCalled();
        expect(consoleLogSpy).not.toHaveBeenCalled();
      });
    });
  });
});
