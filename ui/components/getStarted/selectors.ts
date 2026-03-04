import { FlowState, ProjectState } from './reducer.js';

export const getProject = (state: FlowState): ProjectState => state.project;
