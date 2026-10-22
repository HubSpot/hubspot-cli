import { Environment } from '@hubspot/local-dev-lib/types/Accounts';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import LocalDevState from '../localDev/LocalDevState.js';
import { LOCAL_DEV_SERVER_MESSAGE_TYPES } from '../../constants.js';
import {
  AppLocalDevData,
  LocalDevStateConstructorOptions,
} from '../../../types/LocalDev.js';

const mockExit = vi.fn();

const mockProjectNodes = {
  'node-1': { uid: 'node-1' },
} as unknown as LocalDevStateConstructorOptions['initialProjectNodes'];

const mockProfileData = {
  key: 'value',
} as unknown as LocalDevStateConstructorOptions['initialProjectProfileData'];

const mockProjectData = { id: 123, name: 'my-project' } as unknown as Project;

const mockAppData = {
  id: 1,
  clientId: 'client-id',
  name: 'my-app',
  scopeGroupIds: [1, 2],
} as unknown as AppLocalDevData;

const mockOptions: LocalDevStateConstructorOptions = {
  targetProjectAccountId: 111,
  targetTestingAccountId: 222,
  projectConfig: {
    name: 'my-project',
    srcDir: 'src',
    platformVersion: '2025.2',
  },
  projectDir: '/path/to/project',
  projectData: mockProjectData,
  initialProjectNodes: mockProjectNodes,
  initialProjectProfileData: mockProfileData,
  env: 'qa' as Environment,
  actions: { exit: mockExit },
};

describe('lib/projects/localDev/LocalDevState', () => {
  let state: LocalDevState;

  beforeEach(() => {
    state = new LocalDevState(mockOptions);
  });

  describe('constructor', () => {
    it('should store the provided account IDs, directory, and environment', () => {
      expect(state.targetProjectAccountId).toBe(111);
      expect(state.targetTestingAccountId).toBe(222);
      expect(state.projectDir).toBe('/path/to/project');
      expect(state.env).toBe('qa');
    });

    it('should expose the provided actions', () => {
      expect(state.actions.exit).toBe(mockExit);
    });

    it('should default debug to false when it is not provided', () => {
      expect(state.debug).toBe(false);
    });

    it('should use the provided debug value', () => {
      state = new LocalDevState({ ...mockOptions, debug: true });

      expect(state.debug).toBe(true);
    });

    it('should leave profile undefined when it is not provided', () => {
      expect(state.profile).toBeUndefined();
    });

    it('should use the provided profile', () => {
      state = new LocalDevState({ ...mockOptions, profile: 'qa' });

      expect(state.profile).toBe('qa');
    });

    it('should default autoUploadEnabled to false when it is not provided', () => {
      expect(state.autoUploadEnabled).toBe(false);
    });

    it('should use the provided autoUploadEnabled value', () => {
      state = new LocalDevState({ ...mockOptions, autoUploadEnabled: true });

      expect(state.autoUploadEnabled).toBe(true);
    });

    it('should set initial defaults for the remaining state', () => {
      expect(state.devServerMessage).toBe(
        LOCAL_DEV_SERVER_MESSAGE_TYPES.INITIAL
      );
      expect(state.devServersStarted).toBe(false);
      expect(state.uploadInProgress).toBe(false);
      expect(state.appData).toEqual({});
      expect(state.uploadWarnings.size).toBe(0);
    });

    it('should seed project nodes and project nodes at last deploy with the initial nodes', () => {
      expect(state.projectNodes).toEqual(mockProjectNodes);
      expect(state.projectNodesAtLastDeploy).toEqual(mockProjectNodes);
    });

    it('should seed project profile data with the initial profile data', () => {
      expect(state.projectProfileData).toEqual(mockProfileData);
    });
  });

  describe('getters that clone', () => {
    it('should return a copy of projectConfig that does not mutate internal state', () => {
      const projectConfig = state.projectConfig;
      projectConfig.name = 'changed';

      expect(state.projectConfig.name).toBe('my-project');
    });

    it('should return a copy of projectNodes that does not mutate internal state', () => {
      const projectNodes = state.projectNodes;
      delete projectNodes['node-1'];

      expect(state.projectNodes).toEqual(mockProjectNodes);
    });

    it('should return a copy of projectData that does not mutate internal state', () => {
      const projectData = state.projectData;
      projectData.name = 'changed';

      expect(state.projectData.name).toBe('my-project');
    });

    it('should return a copy of projectProfileData that does not mutate internal state', () => {
      const profileData = state.projectProfileData as Record<string, unknown>;
      profileData.key = 'changed';

      expect(state.projectProfileData).toEqual(mockProfileData);
    });

    it('should return a copy of appData that does not mutate internal state', () => {
      state.setAppDataForUid('app-uid', mockAppData);
      const appData = state.appData;
      delete appData['app-uid'];

      expect(state.appData).toEqual({ 'app-uid': mockAppData });
    });
  });

  describe('projectId', () => {
    it('should return the id from the project data', () => {
      expect(state.projectId).toBe(123);
    });

    it('should reflect updated project data', () => {
      state.projectData = { ...mockProjectData, id: 456 };

      expect(state.projectId).toBe(456);
    });
  });

  describe('setters', () => {
    it('should update projectNodes', () => {
      const nodes = {
        'node-2': { uid: 'node-2' },
      } as unknown as typeof mockProjectNodes;

      state.projectNodes = nodes;

      expect(state.projectNodes).toEqual(nodes);
    });

    it('should update projectNodesAtLastDeploy without changing projectNodes', () => {
      const nodes = {
        'node-2': { uid: 'node-2' },
      } as unknown as typeof mockProjectNodes;

      state.projectNodesAtLastDeploy = nodes;

      expect(state.projectNodesAtLastDeploy).toEqual(nodes);
      expect(state.projectNodes).toEqual(mockProjectNodes);
    });

    it('should update projectProfileData', () => {
      const profileData = {
        other: 'data',
      } as unknown as typeof mockProfileData;

      state.projectProfileData = profileData;

      expect(state.projectProfileData).toEqual(profileData);
    });

    it('should update devServerMessage', () => {
      state.devServerMessage =
        LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED;

      expect(state.devServerMessage).toBe(
        LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED
      );
    });

    it('should update devServersStarted', () => {
      state.devServersStarted = true;

      expect(state.devServersStarted).toBe(true);
    });

    it('should update autoUploadEnabled', () => {
      state.autoUploadEnabled = true;

      expect(state.autoUploadEnabled).toBe(true);
    });

    it('should update uploadInProgress', () => {
      state.uploadInProgress = true;

      expect(state.uploadInProgress).toBe(true);
    });
  });

  describe('app data', () => {
    it('should store app data by uid', () => {
      state.setAppDataForUid('app-uid', mockAppData);

      expect(state.appData).toEqual({ 'app-uid': mockAppData });
    });

    it('should return the app data for a known uid', () => {
      state.setAppDataForUid('app-uid', mockAppData);

      expect(state.getAppDataByUid('app-uid')).toEqual(mockAppData);
    });

    it('should return a copy of the app data for a uid', () => {
      state.setAppDataForUid('app-uid', mockAppData);
      const appData = state.getAppDataByUid('app-uid');
      appData!.name = 'changed';

      expect(state.getAppDataByUid('app-uid')?.name).toBe('my-app');
    });

    it('should notify appData listeners when app data is set', () => {
      const listener = vi.fn();
      state.addListener('appData', listener);
      listener.mockClear();

      state.setAppDataForUid('app-uid', mockAppData);

      expect(listener).toHaveBeenCalledWith({ 'app-uid': mockAppData });
    });
  });

  describe('upload warnings', () => {
    it('should add an upload warning', () => {
      state.addUploadWarning('warning');

      expect(state.uploadWarnings.has('warning')).toBe(true);
    });

    it('should not duplicate an upload warning that was already added', () => {
      state.addUploadWarning('warning');
      state.addUploadWarning('warning');

      expect(state.uploadWarnings.size).toBe(1);
    });

    it('should clear all upload warnings', () => {
      state.addUploadWarning('warning-1');
      state.addUploadWarning('warning-2');

      state.clearUploadWarnings();

      expect(state.uploadWarnings.size).toBe(0);
    });

    it('should notify uploadWarnings listeners when a warning is added', () => {
      const listener = vi.fn();
      state.addListener('uploadWarnings', listener);
      listener.mockClear();

      state.addUploadWarning('warning');

      expect(listener).toHaveBeenCalledWith(new Set(['warning']));
    });

    it('should notify uploadWarnings listeners when warnings are cleared', () => {
      state.addUploadWarning('warning');
      const listener = vi.fn();
      state.addListener('uploadWarnings', listener);
      listener.mockClear();

      state.clearUploadWarnings();

      expect(listener).toHaveBeenCalledWith(new Set());
    });
  });

  describe('addListener()', () => {
    it('should call the listener immediately with the current value', () => {
      const listener = vi.fn();

      state.addListener('devServersStarted', listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(false);
    });

    it('should call the listener when the value changes', () => {
      const listener = vi.fn();
      state.addListener('devServersStarted', listener);

      state.devServersStarted = true;

      expect(listener).toHaveBeenLastCalledWith(true);
    });

    it('should call every listener registered for the same key', () => {
      const firstListener = vi.fn();
      const secondListener = vi.fn();
      state.addListener('uploadInProgress', firstListener);
      state.addListener('uploadInProgress', secondListener);

      state.uploadInProgress = true;

      expect(firstListener).toHaveBeenLastCalledWith(true);
      expect(secondListener).toHaveBeenLastCalledWith(true);
    });

    it('should not call listeners registered for a different key', () => {
      const listener = vi.fn();
      state.addListener('autoUploadEnabled', listener);
      listener.mockClear();

      state.uploadInProgress = true;

      expect(listener).not.toHaveBeenCalled();
    });

    it('should call projectNodes listeners when projectNodes is set', () => {
      const listener = vi.fn();
      state.addListener('projectNodes', listener);
      listener.mockClear();
      const nodes = {
        'node-2': { uid: 'node-2' },
      } as unknown as typeof mockProjectNodes;

      state.projectNodes = nodes;

      expect(listener).toHaveBeenCalledWith(nodes);
    });

    it('should call devServerMessage listeners when devServerMessage is set', () => {
      const listener = vi.fn();
      state.addListener('devServerMessage', listener);
      listener.mockClear();

      state.devServerMessage =
        LOCAL_DEV_SERVER_MESSAGE_TYPES.OAUTH_APP_INSTALL_INITIATED;

      expect(listener).toHaveBeenCalledWith(
        LOCAL_DEV_SERVER_MESSAGE_TYPES.OAUTH_APP_INSTALL_INITIATED
      );
    });

    it('should call autoUploadEnabled listeners when autoUploadEnabled is set', () => {
      const listener = vi.fn();
      state.addListener('autoUploadEnabled', listener);
      listener.mockClear();

      state.autoUploadEnabled = true;

      expect(listener).toHaveBeenCalledWith(true);
    });
  });

  describe('removeListener()', () => {
    it('should stop calling a listener after it is removed', () => {
      const listener = vi.fn();
      state.addListener('devServersStarted', listener);
      listener.mockClear();

      state.removeListener('devServersStarted', listener);
      state.devServersStarted = true;

      expect(listener).not.toHaveBeenCalled();
    });

    it('should keep calling other listeners for the same key', () => {
      const removedListener = vi.fn();
      const remainingListener = vi.fn();
      state.addListener('devServersStarted', removedListener);
      state.addListener('devServersStarted', remainingListener);

      state.removeListener('devServersStarted', removedListener);
      state.devServersStarted = true;

      expect(remainingListener).toHaveBeenLastCalledWith(true);
    });

    it('should not throw when no listeners were registered for the key', () => {
      expect(() =>
        state.removeListener('devServersStarted', vi.fn())
      ).not.toThrow();
    });
  });
});
