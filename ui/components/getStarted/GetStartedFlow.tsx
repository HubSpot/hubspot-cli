import { sanitizeFileName, untildify } from '@hubspot/local-dev-lib/path';
import { useApp, useFocus, useInput } from 'ink';
import open from 'open';
import { useCallback, useEffect, useReducer } from 'react';
import { commands } from '../../../lang/en.js';
import {
  createProjectAction,
  pollAppInstallation,
  trackGetStartedUsage,
  uploadAndDeployAction,
} from '../../../lib/getStartedV2Actions.js';
import { validateProjectDirectory } from '../../../lib/prompts/projectNameAndDestPrompt.js';
import { uiAccountDescription } from '../../../lib/ui/index.js';
import {
  ACTION_STATUSES,
  GET_STARTED_FLOW_STEPS,
} from '../../lib/constants.js';
import { SelectInputItem } from '../SelectInput.js';
import { flowReducer, FlowState, FlowStep } from './reducer.js';
import { InstallationScreen } from './screens/InstallationScreen.js';
import { ProjectSetupScreen } from './screens/ProjectSetupScreen.js';
import { UploadScreen } from './screens/UploadScreen.js';
import { getProject } from './selectors.js';

export const DEFAULT_PROJECT_NAME = 'my-project';

export type GetStartedFlowProps = {
  derivedAccountId: number;
  initialName?: string;
  initialDest?: string;
};

export function getGetStartedFlow(props: GetStartedFlowProps): React.ReactNode {
  return <GetStartedFlow {...props} />;
}

function determineInitialStep(
  initialName?: string,
  initialDest?: string
): FlowStep {
  if (initialName && initialDest) {
    return GET_STARTED_FLOW_STEPS.CREATING;
  } else if (initialName) {
    return GET_STARTED_FLOW_STEPS.DEST_INPUT;
  } else if (initialDest) {
    return GET_STARTED_FLOW_STEPS.NAME_INPUT;
  }
  return GET_STARTED_FLOW_STEPS.SELECT;
}

export function GetStartedFlow({
  derivedAccountId,
  initialName,
  initialDest,
}: GetStartedFlowProps) {
  useFocus({ autoFocus: true });
  const { exit } = useApp();
  const accountName = uiAccountDescription(derivedAccountId);

  const getInitialState = (): FlowState => ({
    step: determineInitialStep(initialName, initialDest),
    project: {
      name: initialName || DEFAULT_PROJECT_NAME,
      destination: initialDest
        ? untildify(initialDest)
        : sanitizeFileName(DEFAULT_PROJECT_NAME),
    },
    app: {
      selectedLabel: initialName ? commands.getStarted.prompts.options.app : '',
    },
    statuses: {
      create: initialName ? ACTION_STATUSES.RUNNING : ACTION_STATUSES.IDLE,
      upload: ACTION_STATUSES.IDLE,
      installApp: ACTION_STATUSES.IDLE,
    },
  });

  const [state, dispatch] = useReducer(flowReducer, getInitialState());

  const project = getProject(state);

  // Only auto-update dest from name if dest wasn't provided via CLI
  useEffect(() => {
    if (!initialDest) {
      dispatch({
        type: 'SET_PROJECT_DEST',
        payload: sanitizeFileName(project.name),
      });
    }
  }, [project.name, initialDest]);

  const handleSelect = useCallback(
    async (item: SelectInputItem) => {
      if (item.disabled) return;

      await trackGetStartedUsage(
        { step: 'select-option', type: item.value },
        derivedAccountId
      );

      dispatch({ type: 'SET_SELECTED_LABEL', payload: item.label });
      dispatch({ type: 'START_PROJECT_CREATION' });
    },
    [derivedAccountId]
  );

  const handleNameSubmit = useCallback(() => {
    dispatch({ type: 'SET_STEP', payload: GET_STARTED_FLOW_STEPS.DEST_INPUT });
  }, []);

  const handleDestSubmit = useCallback(async () => {
    const validationResult = validateProjectDirectory(project.destination);
    if (validationResult !== true) {
      dispatch({
        type: 'SET_DEST_ERROR',
        payload:
          typeof validationResult === 'string'
            ? validationResult
            : commands.getStarted.v2.unknownError,
      });
      return;
    }

    dispatch({ type: 'SET_STEP', payload: GET_STARTED_FLOW_STEPS.CREATING });

    try {
      await createProjectAction({
        projectName: project.name,
        projectDest: project.destination,
      });

      await trackGetStartedUsage(
        { successful: true, step: 'github-clone' },
        derivedAccountId
      );

      await trackGetStartedUsage(
        { successful: true, step: 'project-creation' },
        derivedAccountId
      );

      dispatch({ type: 'PROJECT_CREATION_SUCCESS' });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : commands.getStarted.v2.unknownError;

      await trackGetStartedUsage(
        { successful: false, step: 'project-creation' },
        derivedAccountId
      );

      dispatch({ type: 'PROJECT_CREATION_ERROR', payload: errorMessage });
    }
  }, [derivedAccountId, project.name, project.destination]);

  const handleUploadStart = useCallback(async () => {
    await trackGetStartedUsage(
      { step: 'upload-decision', type: 'upload' },
      derivedAccountId
    );

    dispatch({ type: 'START_UPLOAD' });

    try {
      const result = await uploadAndDeployAction({
        accountId: derivedAccountId,
        projectDest: project.destination,
      });

      await trackGetStartedUsage(
        { successful: true, step: 'upload' },
        derivedAccountId
      );

      dispatch({
        type: 'UPLOAD_SUCCESS',
        payload: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : commands.getStarted.v2.unknownError;

      await trackGetStartedUsage(
        { successful: false, step: 'upload' },
        derivedAccountId
      );

      dispatch({ type: 'UPLOAD_ERROR', payload: errorMessage });
    }
  }, [derivedAccountId, project.destination]);

  const handlePollInstallation = useCallback(async () => {
    const uploadApp = project.uploadResult?.app;
    const projectId = project.uploadResult?.projectId;

    if (!projectId || !uploadApp?.uid) {
      dispatch({
        type: 'INSTALL_APP_ERROR',
        payload: commands.getStarted.v2.unknownError,
      });
      return;
    }

    try {
      await pollAppInstallation({
        accountId: derivedAccountId,
        projectId,
        appUid: uploadApp.uid,
        requiredScopes: uploadApp.config?.auth?.requiredScopes,
        optionalScopes: uploadApp.config?.auth?.optionalScopes,
        onTimeout: () => {
          dispatch({ type: 'SET_POLLING_TIMED_OUT', payload: true });
        },
      });

      dispatch({ type: 'INSTALL_APP_DONE' });
    } catch (error) {
      dispatch({
        type: 'INSTALL_APP_ERROR',
        payload:
          error instanceof Error
            ? error.message
            : commands.getStarted.v2.unknownError,
      });
    }
  }, [project.uploadResult, derivedAccountId]);

  const handleBrowserOpen = useCallback(
    async (shouldOpen: boolean) => {
      await trackGetStartedUsage(
        {
          step: 'open-install-page',
          type: shouldOpen ? 'opened' : 'declined',
        },
        derivedAccountId
      );

      if (shouldOpen && project.uploadResult?.installUrl) {
        try {
          await open(project.uploadResult.installUrl, { url: true });
        } catch (error) {
          dispatch({
            type: 'SET_BROWSER_FAILED_URL',
            payload: project.uploadResult.installUrl,
          });
        }
      }

      dispatch({ type: 'START_INSTALL_APP' });
      await handlePollInstallation();
    },
    [project.uploadResult, derivedAccountId, handlePollInstallation]
  );

  const handleNameChange = useCallback((value: string) => {
    dispatch({ type: 'SET_PROJECT_NAME', payload: value });
  }, []);

  const handleDestChange = useCallback((value: string) => {
    dispatch({ type: 'SET_PROJECT_DEST', payload: value });
  }, []);

  useInput((_, key) => {
    const hasError =
      state.statuses.create === ACTION_STATUSES.ERROR ||
      state.statuses.upload === ACTION_STATUSES.ERROR ||
      state.statuses.installApp === ACTION_STATUSES.ERROR;

    if (hasError) {
      exit();
      return;
    }

    if (!key.return) return;

    if (state.step === GET_STARTED_FLOW_STEPS.COMPLETE) {
      handleUploadStart();
    } else if (state.step === GET_STARTED_FLOW_STEPS.OPEN_APP_PROMPT) {
      handleBrowserOpen(true);
    } else if (
      state.step === GET_STARTED_FLOW_STEPS.INSTALLING_APP &&
      state.statuses.installApp === ACTION_STATUSES.DONE
    ) {
      // Ready for card setup - will be handled in PR3
      exit();
    }
  });

  if (
    state.step === GET_STARTED_FLOW_STEPS.UPLOADING ||
    state.step === GET_STARTED_FLOW_STEPS.OPEN_APP_PROMPT
  ) {
    return <UploadScreen state={state} accountName={accountName} />;
  }

  if (state.step === GET_STARTED_FLOW_STEPS.INSTALLING_APP) {
    return <InstallationScreen state={state} accountName={accountName} />;
  }

  // Show project setup screen for initial flow
  return (
    <ProjectSetupScreen
      state={state}
      onSelectOption={handleSelect}
      onNameChange={handleNameChange}
      onNameSubmit={handleNameSubmit}
      onDestChange={handleDestChange}
      onDestSubmit={handleDestSubmit}
    />
  );
}
