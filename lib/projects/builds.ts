import { type Build } from '@hubspot/local-dev-lib/types/Build';
import { fetchProjectBuilds } from '@hubspot/local-dev-lib/api/projects';
import { BUILD_STATUS } from '@hubspot/local-dev-lib/enums/build';

export async function getLastSuccessfulBuild(
  accountId: number,
  projectName: string,
  latestBuild?: Build
): Promise<Build | undefined> {
  if (latestBuild?.status === BUILD_STATUS.SUCCESS) {
    return latestBuild;
  }

  let after: string | undefined;
  let hasMore = true;
  while (hasMore) {
    const {
      data: { results, paging },
    } = await fetchProjectBuilds(accountId, projectName, {
      limit: 100,
      ...(after ? { after } : {}),
    });

    const successfulBuild = results.find(
      build => build.status === BUILD_STATUS.SUCCESS
    );
    if (successfulBuild) {
      return successfulBuild;
    }

    after = paging?.next?.after;
    hasMore = !!after;
  }

  return undefined;
}
