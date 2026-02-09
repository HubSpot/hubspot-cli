import { http } from '@hubspot/local-dev-lib/http';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';

const DEV_SESSIONS_API_PATH = 'projects-localdev/2025-09/dev-sessions';

export async function registerDevSession(
  accountId: number,
  ports: {
    serverId: string;
    port: number;
  }[],
  force?: boolean
): HubSpotPromise<{ sessionId: number }> {
  return http.post<{ sessionId: number }>(accountId, {
    url: `${DEV_SESSIONS_API_PATH}/register${force ? '?force=true' : ''}`,
    data: { ports },
  });
}

export async function devSessionHeartbeat(
  accountId: number,
  sessionId: number
): HubSpotPromise<void> {
  return http.post<void>(accountId, {
    url: `${DEV_SESSIONS_API_PATH}/${sessionId}/heartbeat`,
    data: {},
  });
}

export async function deleteDevSession(
  accountId: number,
  sessionId: number
): HubSpotPromise<void> {
  return http.delete<void>(accountId, {
    url: `${DEV_SESSIONS_API_PATH}/${sessionId}`,
  });
}
