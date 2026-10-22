import { http } from '@hubspot/local-dev-lib/http';
import {
  registerDevSession,
  devSessionHeartbeat,
  deleteDevSession,
} from '../localDev/helpers/devSessionsApi.js';

vi.mock('@hubspot/local-dev-lib/http');

const mockedHttp = vi.mocked(http);

const MOCK_ACCOUNT_ID = 123;
const MOCK_SESSION_ID = 456;
const DEV_SESSIONS_PATH = 'projects-localdev/2025-09/dev-sessions';

describe('lib/projects/localDev/helpers/devSessionsApi', () => {
  describe('registerDevSession()', () => {
    const mockPorts = [
      { serverId: 'server-1', port: 3000 },
      { serverId: 'server-2', port: 3001 },
    ];

    it('should post the ports to the register endpoint', async () => {
      await registerDevSession(MOCK_ACCOUNT_ID, mockPorts);

      expect(mockedHttp.post).toHaveBeenCalledWith(MOCK_ACCOUNT_ID, {
        url: `${DEV_SESSIONS_PATH}/register`,
        data: { ports: mockPorts },
      });
    });

    it('should not add the force query param when force is false', async () => {
      await registerDevSession(MOCK_ACCOUNT_ID, mockPorts, false);

      expect(mockedHttp.post).toHaveBeenCalledWith(
        MOCK_ACCOUNT_ID,
        expect.objectContaining({ url: `${DEV_SESSIONS_PATH}/register` })
      );
    });

    it('should add the force query param when force is true', async () => {
      await registerDevSession(MOCK_ACCOUNT_ID, mockPorts, true);

      expect(mockedHttp.post).toHaveBeenCalledWith(
        MOCK_ACCOUNT_ID,
        expect.objectContaining({
          url: `${DEV_SESSIONS_PATH}/register?force=true`,
        })
      );
    });

    it('should return the http response', async () => {
      const response = {
        data: { sessionId: MOCK_SESSION_ID },
      } as unknown as Awaited<ReturnType<typeof mockedHttp.post>>;
      mockedHttp.post.mockResolvedValue(response);

      const result = await registerDevSession(MOCK_ACCOUNT_ID, mockPorts);

      expect(result).toBe(response);
    });
  });

  describe('devSessionHeartbeat()', () => {
    it('should post an empty body to the heartbeat endpoint for the session', async () => {
      await devSessionHeartbeat(MOCK_ACCOUNT_ID, MOCK_SESSION_ID);

      expect(mockedHttp.post).toHaveBeenCalledWith(MOCK_ACCOUNT_ID, {
        url: `${DEV_SESSIONS_PATH}/${MOCK_SESSION_ID}/heartbeat`,
        data: {},
      });
    });
  });

  describe('deleteDevSession()', () => {
    it('should send a delete request to the session endpoint', async () => {
      await deleteDevSession(MOCK_ACCOUNT_ID, MOCK_SESSION_ID);

      expect(mockedHttp.delete).toHaveBeenCalledWith(MOCK_ACCOUNT_ID, {
        url: `${DEV_SESSIONS_PATH}/${MOCK_SESSION_ID}`,
      });
    });
  });
});
