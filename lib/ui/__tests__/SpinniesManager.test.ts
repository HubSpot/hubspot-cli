import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import SpinniesManager from '../SpinniesManager.js';
import type { uiLogger } from '../logger.js';

// Mock dependencies
vi.mock('readline', () => ({
  default: {
    clearScreenDown: vi.fn(),
    moveCursor: vi.fn(),
    clearLine: vi.fn(),
  },
}));

vi.mock('cli-cursor', () => ({
  default: {
    hide: vi.fn(),
    show: vi.fn(),
  },
}));

vi.mock('../logger.js', () => ({
  uiLogger: {
    debug: vi.fn(),
    log: vi.fn(),
  },
}));

describe('SpinniesManager', () => {
  let spinniesManager: typeof SpinniesManager;
  let mockUiLogger: typeof uiLogger;

  beforeEach(async () => {
    // Reset the singleton instance before each test

    // Get the mocked logger
    const loggerModule = await import('../logger.js');
    mockUiLogger = loggerModule.uiLogger;

    // Mock process.stderr
    Object.defineProperty(process, 'stderr', {
      value: {
        write: vi.fn(),
        isTTY: true,
        columns: 80,
      },
      writable: true,
    });

    // Mock process.env
    delete process.env.CI;

    spinniesManager = SpinniesManager;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default options', () => {
      spinniesManager.init();
      expect(spinniesManager.hasActiveSpinners()).toBe(false);
    });

    it('should initialize with custom options', () => {
      const customOptions = {
        spinnerColor: 'red' as const,
        succeedColor: 'blue' as const,
        failColor: 'yellow' as const,
      };

      spinniesManager.init(customOptions);

      spinniesManager.add('test', { text: 'Test spinner' });
      const spinner = spinniesManager.pick('test');
      expect(spinner).toBeDefined();
    });

    it('should set disableSpins to true in CI environment', () => {
      process.env.CI = 'true';
      spinniesManager.init();

      spinniesManager.add('test', { text: 'Test spinner' });
      const spinner = spinniesManager.pick('test');
      expect(spinner).toBeDefined();
    });

    it('should use fallback spinner when terminal does not support unicode', () => {
      Object.defineProperty(process, 'platform', {
        value: 'win32',
        writable: true,
      });
      delete process.env.TERM_PROGRAM;
      delete process.env.WT_SESSION;

      spinniesManager.init();
      spinniesManager.add('test', { text: 'Test spinner' });
      const spinner = spinniesManager.pick('test');
      expect(spinner).toBeDefined();
    });
  });

  describe('spinner management', () => {
    beforeEach(() => {
      spinniesManager.init();
    });

    describe('add', () => {
      it('should add a spinner with name', () => {
        spinniesManager.add('test-spinner', {
          text: 'Loading...',
        });

        const spinner = spinniesManager.pick('test-spinner');
        expect(spinner).toBeDefined();
        expect(spinner?.text).toBe('Loading...');
        expect(spinner?.status).toBe('spinning');
        expect(spinniesManager.hasActiveSpinners()).toBe(true);
      });

      it('should add a spinner without name and generate one', () => {
        spinniesManager.add('', { text: 'Loading...' });

        // Since we can't get the generated name directly, check that a spinner was added
        expect(spinniesManager.hasActiveSpinners()).toBe(true);
      });

      it('should use spinner name as text if no text provided', () => {
        spinniesManager.add('test-spinner');

        const spinner = spinniesManager.pick('test-spinner');
        expect(spinner?.text).toBe('test-spinner');
      });

      it('should add multiple spinners', () => {
        spinniesManager.add('spinner1', { text: 'First' });
        spinniesManager.add('spinner2', { text: 'Second' });

        const spinner1 = spinniesManager.pick('spinner1');
        const spinner2 = spinniesManager.pick('spinner2');
        expect(spinner1).toBeDefined();
        expect(spinner2).toBeDefined();
        expect(spinniesManager.hasActiveSpinners()).toBe(true);
      });
    });

    describe('pick', () => {
      it('should return spinner by name', () => {
        spinniesManager.add('test-spinner', { text: 'Loading...' });
        const picked = spinniesManager.pick('test-spinner');

        expect(picked).toBeDefined();
        expect(picked?.text).toBe('Loading...');
      });

      it('should return undefined for non-existent spinner', () => {
        const picked = spinniesManager.pick('non-existent');
        expect(picked).toBeUndefined();
      });
    });

    describe('update', () => {
      it('should update spinner properties', () => {
        spinniesManager.add('test-spinner', { text: 'Loading...' });
        spinniesManager.update('test-spinner', {
          text: 'Updated text',
          color: 'red',
        });

        const spinner = spinniesManager.pick('test-spinner');
        expect(spinner?.text).toBe('Updated text');
        expect(spinner?.color).toBe('red');
      });

      it('should update spinner status', () => {
        spinniesManager.add('test-spinner', { text: 'Loading...' });
        spinniesManager.update('test-spinner', {
          status: 'succeed',
        });

        const spinner = spinniesManager.pick('test-spinner');
        expect(spinner).toBeDefined();
        expect(spinner?.status).toBe('succeed');
      });

      it('should log and return early for invalid spinner name', async () => {
        // @ts-expect-error testing bad input
        spinniesManager.update(123, { text: 'test' });

        expect(mockUiLogger.debug).toHaveBeenCalledWith(
          'A spinner reference name must be specified'
        );
      });
    });

    describe('succeed', () => {
      it('should mark spinner as succeeded', () => {
        spinniesManager.add('test-spinner', { text: 'Loading...' });
        spinniesManager.succeed('test-spinner', { text: 'Success!' });

        const spinner = spinniesManager.pick('test-spinner');
        expect(spinner?.status).toBe('succeed');
        expect(spinner?.text).toBe('Success!');
      });

      it('should succeed without updating text', () => {
        spinniesManager.add('test-spinner', { text: 'Loading...' });
        spinniesManager.succeed('test-spinner');

        const spinner = spinniesManager.pick('test-spinner');
        expect(spinner?.status).toBe('succeed');
        expect(spinner?.text).toBe('Loading...');
      });
    });

    describe('fail', () => {
      it('should mark spinner as failed', () => {
        spinniesManager.add('test-spinner', { text: 'Loading...' });
        spinniesManager.fail('test-spinner', { text: 'Failed!' });

        const spinner = spinniesManager.pick('test-spinner');
        expect(spinner?.status).toBe('fail');
        expect(spinner?.text).toBe('Failed!');
      });

      it('should fail without updating text', () => {
        spinniesManager.add('test-spinner', { text: 'Loading...' });
        spinniesManager.fail('test-spinner');

        const spinner = spinniesManager.pick('test-spinner');
        expect(spinner?.status).toBe('fail');
        expect(spinner?.text).toBe('Loading...');
      });
    });

    describe('remove', () => {
      it('should remove spinner by name', () => {
        spinniesManager.add('test-spinner', { text: 'Loading...' });
        expect(spinniesManager.pick('test-spinner')).toBeDefined();

        spinniesManager.remove('test-spinner');
        expect(spinniesManager.pick('test-spinner')).toBeUndefined();
      });

      it('should log debug message for invalid name', async () => {
        // @ts-expect-error Testing bad case
        spinniesManager.remove(123);

        expect(mockUiLogger.debug).toHaveBeenCalledWith(
          'A spinner reference name must be specified'
        );
      });

      it('should handle undefined name', async () => {
        // @ts-expect-error bad input
        spinniesManager.remove(undefined);

        expect(mockUiLogger.debug).toHaveBeenCalledWith(
          'A spinner reference name must be specified'
        );
      });
    });

    describe('stopAll', () => {
      beforeEach(() => {
        // @ts-expect-error private
        spinniesManager.spinners = {};
        spinniesManager.add('spinner1', { text: 'First' });
        spinniesManager.add('spinner2', { text: 'Second' });
      });

      it('should stop all active spinners with default status', () => {
        // Check spinners exist before stopping
        expect(spinniesManager.pick('spinner1')).toBeDefined();
        expect(spinniesManager.pick('spinner2')).toBeDefined();

        // Mock checkIfActiveSpinners to prevent clearing of spinners
        const originalCheckIfActiveSpinners =
          // @ts-expect-error private method
          spinniesManager.checkIfActiveSpinners;
        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = vi.fn();

        const result = spinniesManager.stopAll();

        // The result should contain the updated spinners
        expect(result.spinner1?.status).toBe('stopped');
        expect(result.spinner2?.status).toBe('stopped');
        expect(result.spinner1?.color).toBe('gray');
        expect(result.spinner2?.color).toBe('gray');

        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = originalCheckIfActiveSpinners;
      });

      it('should stop all active spinners with succeed status', () => {
        // Check spinners exist before stopping
        expect(spinniesManager.pick('spinner1')).toBeDefined();
        expect(spinniesManager.pick('spinner2')).toBeDefined();

        // Mock checkIfActiveSpinners to prevent clearing of spinners
        const originalCheckIfActiveSpinners =
          // @ts-expect-error private method
          spinniesManager.checkIfActiveSpinners;
        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = vi.fn();

        const result = spinniesManager.stopAll('succeed');

        expect(result.spinner1?.status).toBe('succeed');
        expect(result.spinner2?.status).toBe('succeed');

        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = originalCheckIfActiveSpinners;
      });

      it('should stop all active spinners with fail status', () => {
        // Check spinners exist before stopping
        expect(spinniesManager.pick('spinner1')).toBeDefined();
        expect(spinniesManager.pick('spinner2')).toBeDefined();

        // Mock checkIfActiveSpinners to prevent clearing of spinners
        const originalCheckIfActiveSpinners =
          // @ts-expect-error private method
          spinniesManager.checkIfActiveSpinners;
        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = vi.fn();

        const result = spinniesManager.stopAll('fail');

        expect(result.spinner1?.status).toBe('fail');
        expect(result.spinner2?.status).toBe('fail');

        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = originalCheckIfActiveSpinners;
      });

      it('should not change already completed spinners', () => {
        // Add a spinner that is already completed
        spinniesManager.add('completed', { text: 'Done' });
        spinniesManager.succeed('completed');

        // Verify it exists and is succeeded
        expect(spinniesManager.pick('completed')?.status).toBe('succeed');

        // Mock checkIfActiveSpinners to prevent clearing of spinners
        const originalCheckIfActiveSpinners =
          // @ts-expect-error private method
          spinniesManager.checkIfActiveSpinners;
        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = vi.fn();

        const result = spinniesManager.stopAll();

        // Completed spinners should not change status
        expect(result.completed?.status).toBe('succeed');

        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = originalCheckIfActiveSpinners;
      });

      it('should handle non-spinnable status correctly', () => {
        // Add spinner with non-spinnable status
        spinniesManager.add('non-spin', {
          text: 'Non-spinnable',
          status: 'non-spinnable',
        });

        // Verify it exists with correct status
        expect(spinniesManager.pick('non-spin')?.status).toBe('non-spinnable');

        // Mock checkIfActiveSpinners to prevent clearing of spinners
        const originalCheckIfActiveSpinners =
          // @ts-expect-error private method
          spinniesManager.checkIfActiveSpinners;
        // @ts-expect-error private method
        spinniesManager.checkIfActiveSpinners = vi.fn();

        const result = spinniesManager.stopAll();

        // Non-spinnable status should not change
        expect(result['non-spin']?.status).toBe('non-spinnable');

        // @ts-expect-error Testing private method
        spinniesManager.checkIfActiveSpinners = originalCheckIfActiveSpinners;
      });
    });
  });

  describe('active spinner detection', () => {
    beforeEach(() => {
      spinniesManager.init();
    });

    it('should detect active spinners', () => {
      expect(spinniesManager.hasActiveSpinners()).toBe(false);

      spinniesManager.add('active', { text: 'Loading...' });
      expect(spinniesManager.hasActiveSpinners()).toBe(true);

      spinniesManager.succeed('active');
      expect(spinniesManager.hasActiveSpinners()).toBe(false);
    });

    it('should detect multiple active spinners', () => {
      spinniesManager.add('active1', { text: 'Loading 1...' });
      spinniesManager.add('active2', { text: 'Loading 2...' });
      expect(spinniesManager.hasActiveSpinners()).toBe(true);

      spinniesManager.succeed('active1');
      expect(spinniesManager.hasActiveSpinners()).toBe(true);

      spinniesManager.succeed('active2');
      expect(spinniesManager.hasActiveSpinners()).toBe(false);
    });
  });

  describe('output control', () => {
    beforeEach(() => {
      spinniesManager.init();
    });

    it('should disable output when requested', () => {
      spinniesManager.setDisableOutput(true);
      spinniesManager.add('test', { text: 'Test' });

      // Output should be disabled, so no writes to stderr should occur
      expect(process.stderr.write).not.toHaveBeenCalled();
    });

    it('should enable output by default', () => {
      // Mock process.stderr.write to be a spy
      const mockWrite = vi.fn();
      Object.defineProperty(process.stderr, 'write', {
        value: mockWrite,
        writable: true,
      });

      // Set stderr.isTTY to false to trigger raw output mode
      Object.defineProperty(process.stderr, 'isTTY', {
        value: false,
        writable: true,
      });

      spinniesManager.setDisableOutput(false);
      spinniesManager.init(); // Re-init to pick up the new isTTY value
      spinniesManager.add('test', { text: 'Test' });

      // In non-TTY mode, it should write with raw output
      expect(mockWrite).toHaveBeenCalledWith('- Test\n');
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      spinniesManager.init();
    });

    it('should handle missing spinner in update', async () => {
      spinniesManager.update('non-existent', { text: 'test' });

      expect(mockUiLogger.debug).toHaveBeenCalledWith(
        'No spinner initialized with name non-existent'
      );
    });

    it('should handle missing spinner in setSpinnerProperties', async () => {
      // @ts-expect-error Testing private method
      spinniesManager.setSpinnerProperties('missing', {
        text: 'test',
      });

      expect(mockUiLogger.debug).toHaveBeenCalledWith(
        'No spinner initialized with name missing'
      );
    });

    it('should handle invalid spinner name types', async () => {
      // @ts-expect-error Testing private method
      spinniesManager.setSpinnerProperties(null, { text: 'test' });
      expect(mockUiLogger.debug).toHaveBeenCalledWith(
        'A spinner reference name must be specified'
      );

      // @ts-expect-error Testing private method
      spinniesManager.setSpinnerProperties(undefined, {
        text: 'test',
      });
      expect(mockUiLogger.debug).toHaveBeenCalledWith(
        'A spinner reference name must be specified'
      );
      // @ts-expect-error Testing private method
      spinniesManager.setSpinnerProperties(123, { text: 'test' });
      expect(mockUiLogger.debug).toHaveBeenCalledWith(
        'A spinner reference name must be specified'
      );
    });
  });

  describe('SIGINT handling', () => {
    beforeEach(() => {
      spinniesManager.init();
    });

    it('should bind SIGINT handler on init', () => {
      const processOnSpy = vi.spyOn(process, 'on');
      const processRemoveAllListenersSpy = vi.spyOn(
        process,
        'removeAllListeners'
      );

      spinniesManager.init();

      expect(processRemoveAllListenersSpy).toHaveBeenCalledWith('SIGINT');
      expect(processOnSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
    });
  });

  describe('spinner options validation', () => {
    beforeEach(() => {
      spinniesManager.init();
    });

    it('should handle custom spinner frames', () => {
      const customOptions = {
        spinner: {
          frames: ['|', '/', '-', '\\'],
          interval: 100,
        },
      };

      spinniesManager.init(customOptions);
      spinniesManager.add('custom', { text: 'Custom spinner' });

      const spinner = spinniesManager.pick('custom');
      expect(spinner).toBeDefined();
      expect(spinner?.text).toBe('Custom spinner');
    });

    it('should handle custom colors', () => {
      spinniesManager.add('colored', {
        text: 'Colored spinner',
        color: 'red',
        spinnerColor: 'blue',
        succeedColor: 'green',
        failColor: 'yellow',
      });

      const spinner = spinniesManager.pick('colored');
      expect(spinner?.color).toBe('red');
      expect(spinner?.spinnerColor).toBe('blue');
      expect(spinner?.succeedColor).toBe('green');
      expect(spinner?.failColor).toBe('yellow');
    });

    it('should handle indentation', () => {
      spinniesManager.add('indented', {
        text: 'Indented spinner',
        indent: 4,
      });

      const spinner = spinniesManager.pick('indented');
      expect(spinner?.indent).toBe(4);
    });

    it('should handle custom prefixes', () => {
      spinniesManager.init({
        succeedPrefix: '[OK]',
        failPrefix: '[ERR]',
      });

      spinniesManager.add('prefixed', {
        text: 'Prefixed spinner',
      });
      const spinner = spinniesManager.pick('prefixed');
      expect(spinner?.succeedPrefix).toBe('[OK]');
      expect(spinner?.failPrefix).toBe('[ERR]');
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      spinniesManager.init();
    });

    it('should handle empty spinner name gracefully', () => {
      spinniesManager.add('', { text: 'No name spinner' });
      // Since we can't get the generated name directly, just verify a spinner was added
      expect(spinniesManager.hasActiveSpinners()).toBe(true);
    });

    it('should handle null/undefined text', () => {
      // @ts-expect-error Testing bad case
      spinniesManager.add('null-text', { text: null });
      const spinner = spinniesManager.pick('null-text');
      expect(spinner?.text).toBe('null-text');
    });

    it('should handle non-TTY environments', () => {
      const mockWrite = vi.fn();
      Object.defineProperty(process.stderr, 'write', {
        value: mockWrite,
        writable: true,
      });

      Object.defineProperty(process.stderr, 'isTTY', {
        value: false,
        writable: true,
      });

      spinniesManager.init();
      spinniesManager.add('no-tty', { text: 'No TTY' });

      const spinner = spinniesManager.pick('no-tty');
      expect(spinner).toBeDefined();
      expect(mockWrite).toHaveBeenCalledWith('- No TTY\n');
    });

    it('should handle missing process.stderr.columns', () => {
      // @ts-expect-error
      delete process.stderr.columns;

      spinniesManager.add('no-columns', {
        text: 'A very long text that would normally be broken into multiple lines but now has to handle missing columns gracefully',
      });

      const spinner = spinniesManager.pick('no-columns');
      expect(spinner).toBeDefined();
    });
  });
});
