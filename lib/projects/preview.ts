import {
  triggerAutoRelease,
  getAutoReleaseStatus,
  AutoReleaseResponse,
} from '../../api/releases.js';

import { PREVIEW_POLL_TIMEOUT } from '../constants.js';
import { poll } from '../polling.js';
import SpinniesManager from '../ui/SpinniesManager.js';
import { logError, ApiErrorContext } from '../errorHandlers/index.js';
import { lib } from '../../lang/en.js';

type PreviewResult = {
  succeeded: boolean;
  releaseTag?: string;
  appId?: number;
};

export async function triggerAndPollPreview(
  accountId: number,
  projectId: number,
  buildId: number,
  targetPortalId: number
): Promise<PreviewResult> {
  let triggerResponse: AutoReleaseResponse;

  SpinniesManager.add('preview', {
    text: lib.projectPreview.triggeringPreview(buildId, targetPortalId),
    succeedColor: 'white',
  });

  try {
    const { data } = await triggerAutoRelease(
      accountId,
      projectId,
      buildId,
      targetPortalId
    );
    triggerResponse = data;
  } catch (e) {
    SpinniesManager.fail('preview', {
      text: lib.projectPreview.triggerFailed,
    });
    logError(
      e,
      new ApiErrorContext({
        accountId,
        request: 'preview trigger',
      })
    );
    return { succeeded: false };
  }

  const { releaseTag, appId } = triggerResponse;

  SpinniesManager.update('preview', {
    text: lib.projectPreview.pollingStatus(releaseTag, targetPortalId),
  });

  try {
    await poll(
      () =>
        getAutoReleaseStatus(
          accountId,
          projectId,
          targetPortalId,
          releaseTag,
          appId
        ),
      { successStates: ['COMPLETE'], errorStates: [] },
      PREVIEW_POLL_TIMEOUT
    );
  } catch (e) {
    SpinniesManager.fail('preview', {
      text: lib.projectPreview.pollFailed,
    });
    logError(
      e,
      new ApiErrorContext({
        accountId,
        request: 'preview status',
      })
    );
    return { succeeded: false, releaseTag, appId };
  }

  SpinniesManager.succeed('preview', {
    text: lib.projectPreview.succeeded(releaseTag, targetPortalId),
  });

  return { succeeded: true, releaseTag, appId };
}
