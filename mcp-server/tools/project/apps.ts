import { http } from '@hubspot/local-dev-lib/http';

export interface AppInfo {
  appId: number;
  appName: string;
}

export interface GetAppsResponse {
  applications: AppInfo[];
}

export async function getApps(accountId: number): Promise<GetAppsResponse> {
  const response = await http.get<GetAppsResponse>(accountId, {
    url: 'app/feature/utilization/public/v3/insights/apps',
  });
  return response.data;
}
