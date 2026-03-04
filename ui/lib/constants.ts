export const ACTION_STATUSES = {
  IDLE: 'idle',
  RUNNING: 'running',
  DONE: 'done',
  ERROR: 'error',
} as const;

export const GET_STARTED_FLOW_STEPS = {
  SELECT: 'select',
  NAME_INPUT: 'name-input',
  DEST_INPUT: 'dest-input',
  CREATING: 'creating',
  INSTALLING: 'installing',
  UPLOADING: 'uploading',
  OPEN_APP_PROMPT: 'open-app-prompt',
  INSTALLING_APP: 'installing-app',
  COMPLETE: 'complete',
} as const;
