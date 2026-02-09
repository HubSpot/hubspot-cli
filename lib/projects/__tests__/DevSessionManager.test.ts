import { getActiveServers } from '@hubspot/local-dev-lib/portManager';
import LocalDevLogger from '../localDev/LocalDevLogger.js';
import {
  devSessionHeartbeat,
  registerDevSession,
  deleteDevSession,
} from '../localDev/helpers/devSessionsApi.js';
import DevSessionManager from '../localDev/DevSessionManager.js';
import { Mock, vi, Mocked } from 'vitest';
import { EXIT_CODES } from '../../enums/exitCodes.js';

vi.mock('@hubspot/local-dev-lib/portManager');
vi.mock('../localDev/helpers/devSessionsApi.js');
vi.mock('../localDev/LocalDevState');
vi.mock('../localDev/LocalDevLogger');

const processExitSpy = vi.spyOn(process, 'exit');

describe('DevSessionManager', () => {
  let mockTargetTestingAccountId: number;
  let mockLocalDevLogger: Mocked<LocalDevLogger>;
  let devSessionManager: DevSessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockTargetTestingAccountId = 456;
    mockLocalDevLogger = {
      devSessionRegistrationError: vi.fn(),
      devSessionMissingSessionIdError: vi.fn(),
      devSessionHeartbeatError: vi.fn(),
      devSessionDeletionError: vi.fn(),
    } as unknown as Mocked<LocalDevLogger>;

    devSessionManager = new DevSessionManager({
      targetTestingAccountId: mockTargetTestingAccountId,
      localDevLogger: mockLocalDevLogger,
    });

    // Spy on clearInterval but let it actually work
    vi.spyOn(global, 'clearInterval');
  });

  afterEach(() => {
    // Clear any remaining intervals
    // @ts-expect-error accessing private property for testing
    if (devSessionManager._heartbeatInterval) {
      // @ts-expect-error accessing private property for testing
      clearInterval(devSessionManager._heartbeatInterval);
    }
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with provided options', () => {
      expect(devSessionManager.targetTestingAccountId).toBe(
        mockTargetTestingAccountId
      );
      expect(devSessionManager.localDevLogger).toBe(mockLocalDevLogger);
      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._devSessionId).toBeUndefined();
      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._heartbeatInterval).toBeUndefined();
      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._heartbeatRetries).toBe(0);
    });
  });

  describe('registerDevSession()', () => {
    it('should successfully register dev session and initialize heartbeat', async () => {
      const mockActiveServers = {
        'server-1': 3000,
        'server-2': 3001,
      };
      const mockSessionId = 789;

      (getActiveServers as Mock).mockResolvedValue(mockActiveServers);
      (registerDevSession as Mock).mockResolvedValue({
        data: { sessionId: mockSessionId },
      });

      const result = await devSessionManager.registerSession();

      expect(getActiveServers).toHaveBeenCalled();
      expect(registerDevSession).toHaveBeenCalledWith(
        mockTargetTestingAccountId,
        [
          { serverId: 'server-1', port: 3000 },
          { serverId: 'server-2', port: 3001 },
        ]
      );
      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._devSessionId).toBe(mockSessionId);
      expect(result).toBe(true);
      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._heartbeatInterval).toBeDefined();
    });

    it('should return false and log error when registration fails', async () => {
      const error = new Error('Registration failed');
      (getActiveServers as Mock).mockResolvedValue({});
      (registerDevSession as Mock).mockRejectedValue(error);

      const result = await devSessionManager.registerSession();

      expect(
        mockLocalDevLogger.devSessionRegistrationError
      ).toHaveBeenCalledWith(error);
      expect(result).toBe(false);
      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._devSessionId).toBeUndefined();
    });

    it('should exit if session ID is missing after registration', async () => {
      (getActiveServers as Mock).mockResolvedValue({});
      (registerDevSession as Mock).mockResolvedValue({
        data: { sessionId: undefined },
      });

      await expect(devSessionManager.registerSession()).rejects.toThrow();
      expect(
        mockLocalDevLogger.devSessionMissingSessionIdError
      ).toHaveBeenCalled();
    });

    it('should handle empty active servers', async () => {
      const mockSessionId = 789;
      (getActiveServers as Mock).mockResolvedValue({});
      (registerDevSession as Mock).mockResolvedValue({
        data: { sessionId: mockSessionId },
      });

      const result = await devSessionManager.registerSession();

      expect(registerDevSession).toHaveBeenCalledWith(
        mockTargetTestingAccountId,
        []
      );
      expect(result).toBe(true);
    });
  });

  describe('deleteDevSession()', () => {
    it('should successfully delete dev session when session ID exists', async () => {
      // @ts-expect-error accessing private property for testing
      devSessionManager._devSessionId = 789;
      const mockInterval = setInterval(() => {}, 30000);
      // @ts-expect-error accessing private property for testing
      devSessionManager._heartbeatInterval = mockInterval;

      (deleteDevSession as Mock).mockResolvedValue(undefined);

      const result = await devSessionManager.deleteDevSession();

      expect(deleteDevSession).toHaveBeenCalledWith(
        mockTargetTestingAccountId,
        789
      );
      expect(clearInterval).toHaveBeenCalledWith(mockInterval);
      expect(result).toBe(true);
    });

    it('should return true when no session ID exists', async () => {
      // @ts-expect-error accessing private property for testing
      devSessionManager._devSessionId = undefined;

      const result = await devSessionManager.deleteDevSession();

      expect(deleteDevSession).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should return false and log error when deletion fails', async () => {
      const error = new Error('Deletion failed');
      // @ts-expect-error accessing private property for testing
      devSessionManager._devSessionId = 789;
      // @ts-expect-error accessing private property for testing
      devSessionManager._heartbeatInterval = setInterval(() => {}, 30000);

      (deleteDevSession as Mock).mockRejectedValue(error);

      const result = await devSessionManager.deleteDevSession();

      expect(mockLocalDevLogger.devSessionDeletionError).toHaveBeenCalledWith(
        error
      );
      expect(result).toBe(false);
    });
  });

  describe('heartbeat', () => {
    it('should send heartbeat every 30 seconds after registration', async () => {
      const mockSessionId = 789;
      (getActiveServers as Mock).mockResolvedValue({});
      (registerDevSession as Mock).mockResolvedValue({
        data: { sessionId: mockSessionId },
      });
      (devSessionHeartbeat as Mock).mockResolvedValue(undefined);
      // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
      processExitSpy.mockImplementation(() => {});

      await devSessionManager.registerSession();

      // Fast-forward time to trigger heartbeat
      await vi.advanceTimersByTimeAsync(30000);

      expect(devSessionHeartbeat).toHaveBeenCalledWith(
        mockTargetTestingAccountId,
        mockSessionId
      );

      // Reset mock to count only the second call
      (devSessionHeartbeat as Mock).mockClear();

      // Fast-forward again to trigger another heartbeat
      await vi.advanceTimersByTimeAsync(30000);

      expect(devSessionHeartbeat).toHaveBeenCalledTimes(1);

      // Clean up interval
      // @ts-expect-error accessing private property for testing
      if (devSessionManager._heartbeatInterval) {
        // @ts-expect-error accessing private property for testing
        clearInterval(devSessionManager._heartbeatInterval);
      }
    });

    it('should retry heartbeat on failure up to 3 times', async () => {
      const mockSessionId = 789;
      const error = new Error('Heartbeat failed');
      (getActiveServers as Mock).mockResolvedValue({});
      (registerDevSession as Mock).mockResolvedValue({
        data: { sessionId: mockSessionId },
      });
      (devSessionHeartbeat as Mock).mockRejectedValue(error);

      // @ts-expect-error Doesn't match the actual signature because then the linter complains about unused variables
      processExitSpy.mockImplementation(() => {});

      await devSessionManager.registerSession();

      // Fast-forward to trigger 3 failed heartbeats
      for (let i = 0; i < 3; i++) {
        await vi.advanceTimersByTimeAsync(30000);
      }

      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._heartbeatRetries).toBe(3);
      expect(devSessionHeartbeat).toHaveBeenCalledTimes(3);

      // Advance timers - the error will be captured by errorPromise
      await vi.advanceTimersByTimeAsync(30000);

      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(mockLocalDevLogger.devSessionHeartbeatError).toHaveBeenCalledWith(
        error
      );
    });

    it('should reset retry count on successful heartbeat', async () => {
      const mockSessionId = 789;
      const error = new Error('Heartbeat failed');
      (getActiveServers as Mock).mockResolvedValue({});
      (registerDevSession as Mock).mockResolvedValue({
        data: { sessionId: mockSessionId },
      });

      // First heartbeat fails, then succeeds
      (devSessionHeartbeat as Mock)
        .mockRejectedValueOnce(error)
        .mockResolvedValue(undefined);

      await devSessionManager.registerSession();

      // Trigger first failed heartbeat
      await vi.advanceTimersByTimeAsync(30000);
      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._heartbeatRetries).toBe(1);

      // Trigger successful heartbeat
      await vi.advanceTimersByTimeAsync(30000);
      // @ts-expect-error accessing private property for testing
      expect(devSessionManager._heartbeatRetries).toBe(1); // Should not reset, but next failure should increment

      // Clean up interval
      // @ts-expect-error accessing private property for testing
      if (devSessionManager._heartbeatInterval) {
        // @ts-expect-error accessing private property for testing
        clearInterval(devSessionManager._heartbeatInterval);
      }
    });

    it('should exit if session ID is missing during heartbeat', async () => {
      const mockSessionId = 789;
      (getActiveServers as Mock).mockResolvedValue({});
      (registerDevSession as Mock).mockResolvedValue({
        data: { sessionId: mockSessionId },
      });
      (devSessionHeartbeat as Mock).mockResolvedValue(undefined);

      await devSessionManager.registerSession();

      // Clear the session ID to simulate missing session
      // @ts-expect-error accessing private property for testing
      devSessionManager._devSessionId = undefined;

      // Advance timers - the error will be captured by errorPromise
      await vi.advanceTimersByTimeAsync(30000);
      expect(processExitSpy).toHaveBeenCalledWith(EXIT_CODES.ERROR);
      expect(
        mockLocalDevLogger.devSessionMissingSessionIdError
      ).toHaveBeenCalled();
    });

    it('should clear heartbeat interval when session is deleted', async () => {
      const mockSessionId = 789;
      (getActiveServers as Mock).mockResolvedValue({});
      (registerDevSession as Mock).mockResolvedValue({
        data: { sessionId: mockSessionId },
      });
      (devSessionHeartbeat as Mock).mockResolvedValue(undefined);
      (deleteDevSession as Mock).mockResolvedValue(undefined);

      await devSessionManager.registerSession();

      // @ts-expect-error accessing private property for testing
      const intervalId = devSessionManager._heartbeatInterval;
      expect(intervalId).toBeDefined();

      // Reset mock to count calls after deletion
      (devSessionHeartbeat as Mock).mockClear();

      await devSessionManager.deleteDevSession();

      expect(clearInterval).toHaveBeenCalledWith(intervalId);

      // Fast-forward time - heartbeat should not be called
      await vi.advanceTimersByTimeAsync(30000);
      expect(devSessionHeartbeat).not.toHaveBeenCalled();
    });
  });
});
