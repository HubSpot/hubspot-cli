import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';
import { type UploadAndDeployResult } from '../../../lib/getStartedV2Actions.js';
import {
  ACTION_STATUSES,
  GET_STARTED_FLOW_STEPS,
} from '../../lib/constants.js';

export type FlowStep = ValueOf<typeof GET_STARTED_FLOW_STEPS>;
export type ActionStatus = ValueOf<typeof ACTION_STATUSES>;

export type ProjectState = {
  name: string;
  destination: string;
  uploadResult?: UploadAndDeployResult;
};

export type AppState = {
  selectedLabel: string;
};

export type ActionStatuses = {
  create: ActionStatus;
  upload: ActionStatus;
  installApp: ActionStatus;
};

export type FlowState = {
  step: FlowStep;
  project: ProjectState;
  app: AppState;
  statuses: ActionStatuses;
  error?: string;
  destError?: string;
  browserFailedUrl?: string;
  pollingTimedOut?: boolean;
};

type FlowAction =
  | { type: 'SET_STEP'; payload: FlowStep }
  | { type: 'SET_SELECTED_LABEL'; payload: string }
  | { type: 'SET_PROJECT_NAME'; payload: string }
  | { type: 'SET_PROJECT_DEST'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_DEST_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' }
  | { type: 'START_PROJECT_CREATION' }
  | { type: 'PROJECT_CREATION_SUCCESS' }
  | { type: 'PROJECT_CREATION_ERROR'; payload: string }
  | { type: 'START_UPLOAD' }
  | { type: 'UPLOAD_SUCCESS'; payload: UploadAndDeployResult }
  | { type: 'UPLOAD_ERROR'; payload: string }
  | { type: 'START_INSTALL_APP' }
  | { type: 'INSTALL_APP_DONE' }
  | { type: 'INSTALL_APP_ERROR'; payload: string }
  | { type: 'SET_BROWSER_FAILED_URL'; payload: string }
  | { type: 'SET_POLLING_TIMED_OUT'; payload: boolean };

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, step: action.payload };

    case 'SET_SELECTED_LABEL':
      return {
        ...state,
        app: { ...state.app, selectedLabel: action.payload },
      };

    case 'SET_PROJECT_NAME':
      return {
        ...state,
        project: { ...state.project, name: action.payload },
      };

    case 'SET_PROJECT_DEST':
      return {
        ...state,
        project: { ...state.project, destination: action.payload },
        destError: undefined,
      };

    case 'SET_DEST_ERROR':
      return {
        ...state,
        step: GET_STARTED_FLOW_STEPS.DEST_INPUT,
        destError: action.payload,
      };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: undefined };

    case 'START_PROJECT_CREATION':
      return {
        ...state,
        step: GET_STARTED_FLOW_STEPS.NAME_INPUT,
        statuses: { ...state.statuses, create: ACTION_STATUSES.RUNNING },
        error: undefined,
      };

    case 'PROJECT_CREATION_SUCCESS':
      return {
        ...state,
        step: GET_STARTED_FLOW_STEPS.COMPLETE,
        statuses: { ...state.statuses, create: ACTION_STATUSES.DONE },
        error: undefined,
      };

    case 'PROJECT_CREATION_ERROR':
      return {
        ...state,
        statuses: { ...state.statuses, create: ACTION_STATUSES.ERROR },
        error: action.payload,
      };

    case 'START_UPLOAD':
      return {
        ...state,
        step: GET_STARTED_FLOW_STEPS.UPLOADING,
        statuses: { ...state.statuses, upload: ACTION_STATUSES.RUNNING },
        error: undefined,
      };

    case 'UPLOAD_SUCCESS':
      return {
        ...state,
        step: GET_STARTED_FLOW_STEPS.OPEN_APP_PROMPT,

        statuses: { ...state.statuses, upload: ACTION_STATUSES.DONE },
        project: {
          ...state.project,
          uploadResult: action.payload,
        },
        error: undefined,
      };

    case 'UPLOAD_ERROR':
      return {
        ...state,
        statuses: { ...state.statuses, upload: ACTION_STATUSES.ERROR },
        error: action.payload,
      };

    case 'START_INSTALL_APP':
      return {
        ...state,
        step: GET_STARTED_FLOW_STEPS.INSTALLING_APP,
        statuses: { ...state.statuses, installApp: ACTION_STATUSES.RUNNING },
        error: undefined,
        pollingTimedOut: false,
      };

    case 'INSTALL_APP_DONE':
      return {
        ...state,
        statuses: { ...state.statuses, installApp: ACTION_STATUSES.DONE },
      };

    case 'INSTALL_APP_ERROR':
      return {
        ...state,
        statuses: { ...state.statuses, installApp: ACTION_STATUSES.ERROR },
        error: action.payload,
      };

    case 'SET_BROWSER_FAILED_URL':
      return {
        ...state,
        browserFailedUrl: action.payload,
      };

    case 'SET_POLLING_TIMED_OUT':
      return {
        ...state,
        pollingTimedOut: action.payload,
      };

    default:
      return state;
  }
}
