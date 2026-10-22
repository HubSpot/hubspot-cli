import { getServerPortByInstanceId } from '@hubspot/local-dev-lib/portManager';
import { LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID } from '../../constants.js';
import { isLocalDevRunning } from '../localDev/helpers/process.js';

vi.mock('@hubspot/local-dev-lib/portManager');

const mockedGetServerPortByInstanceId = vi.mocked(getServerPortByInstanceId);

describe('lib/projects/localDev/helpers/process', () => {
  describe('isLocalDevRunning()', () => {
    it('should look up the port for the local dev websocket server instance', async () => {
      mockedGetServerPortByInstanceId.mockResolvedValue(8080);

      await isLocalDevRunning();

      expect(mockedGetServerPortByInstanceId).toHaveBeenCalledWith(
        LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID
      );
    });

    it('should return true when a port is in use', async () => {
      mockedGetServerPortByInstanceId.mockResolvedValue(8080);

      const result = await isLocalDevRunning();

      expect(result).toBe(true);
    });

    it('should return false when no port is in use', async () => {
      mockedGetServerPortByInstanceId.mockResolvedValue(0);

      const result = await isLocalDevRunning();

      expect(result).toBe(false);
    });

    it('should return false when the port lookup throws', async () => {
      mockedGetServerPortByInstanceId.mockRejectedValue(new Error('failed'));

      const result = await isLocalDevRunning();

      expect(result).toBe(false);
    });
  });
});
