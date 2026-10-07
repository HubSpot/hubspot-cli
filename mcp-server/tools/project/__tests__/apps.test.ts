import { getApps } from '../apps.js';
import { http } from '@hubspot/local-dev-lib/http';
import { Mocked } from 'vitest';

vi.mock('@hubspot/local-dev-lib/http');

const mockHttp = http as Mocked<typeof http>;

describe('mcp-server/tools/project/apps', () => {
  it('fetches apps from the insights endpoint and returns the data', async () => {
    mockHttp.get.mockResolvedValue({
      data: { applications: [{ appId: 1, appName: 'A' }] },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getApps(123);

    expect(mockHttp.get).toHaveBeenCalledWith(123, {
      url: 'app/feature/utilization/public/v3/insights/apps',
    });
    expect(result).toEqual({ applications: [{ appId: 1, appName: 'A' }] });
  });
});
