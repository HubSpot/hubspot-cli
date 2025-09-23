import {
  IntermediateRepresentationNodeLocalDev,
  HSProfileVariables,
} from '@hubspot/project-parsing-lib/src/lib/types.js';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { ProjectConfig } from '../../../types/Projects.js';
import {
  LocalDevStateConstructorOptions,
  LocalDevStateListener,
  AppLocalDevData,
  LocalDevServerMessage,
} from '../../../types/LocalDev.js';
import { LOCAL_DEV_SERVER_MESSAGE_TYPES } from '../../constants.js';

class LocalDevState {
  private _targetProjectAccountId: number;
  private _targetTestingAccountId: number;
  private _profile?: string;
  private _projectConfig: ProjectConfig;
  private _projectDir: string;
  private _projectData: Project;
  private _debug: boolean;
  private _projectNodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  };
  private _projectProfileData: HSProfileVariables;
  private _projectNodesAtLastDeploy: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  };
  private _env: Environment;
  private _listeners: {
    [key in keyof LocalDevState]?: LocalDevStateListener<key>[];
  };
  private _appData: Record<string, AppLocalDevData>;
  private _devServerMessage: LocalDevServerMessage;
  private _uploadWarnings: Set<string>;

  constructor({
    targetProjectAccountId,
    targetTestingAccountId,
    projectConfig,
    projectDir,
    projectData,
    debug,
    initialProjectNodes,
    initialProjectProfileData,
    profile,
    env,
  }: LocalDevStateConstructorOptions) {
    this._targetProjectAccountId = targetProjectAccountId;
    this._targetTestingAccountId = targetTestingAccountId;
    this._profile = profile;
    this._projectConfig = projectConfig;
    this._projectDir = projectDir;
    this._projectData = projectData;
    this._debug = debug || false;
    this._projectNodes = initialProjectNodes;
    this._projectNodesAtLastDeploy = initialProjectNodes;
    this._projectProfileData = initialProjectProfileData;
    this._env = env;
    this._appData = {};
    this._devServerMessage = LOCAL_DEV_SERVER_MESSAGE_TYPES.INITIAL;
    this._uploadWarnings = new Set();

    this._listeners = {};
  }

  private runListeners<K extends keyof LocalDevState>(key: K): void {
    if (this._listeners[key] && this._listeners[key].length) {
      this._listeners[key].forEach(listener => listener(this[key]));
    }
  }

  get targetProjectAccountId(): number {
    return this._targetProjectAccountId;
  }

  get targetTestingAccountId(): number {
    return this._targetTestingAccountId;
  }

  get profile(): string | undefined {
    return this._profile;
  }

  get projectConfig(): ProjectConfig {
    return structuredClone(this._projectConfig);
  }

  get projectDir(): string {
    return this._projectDir;
  }

  get debug(): boolean {
    return this._debug;
  }

  get projectNodes(): {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  } {
    return structuredClone(this._projectNodes);
  }

  set projectNodes(nodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  }) {
    this._projectNodes = nodes;
    this.runListeners('projectNodes');
  }

  get projectProfileData(): HSProfileVariables {
    return structuredClone(this._projectProfileData);
  }

  set projectProfileData(profileData: HSProfileVariables) {
    this._projectProfileData = profileData;
  }

  get projectNodesAtLastDeploy(): {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  } {
    return structuredClone(this._projectNodesAtLastDeploy);
  }

  set projectNodesAtLastDeploy(nodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  }) {
    this._projectNodesAtLastDeploy = nodes;
  }

  get projectData(): Project {
    return structuredClone(this._projectData);
  }

  get projectId(): number {
    return this.projectData.id;
  }

  set projectData(projectData: Project) {
    this._projectData = projectData;
  }

  get env(): Environment {
    return this._env;
  }

  get appData(): Record<string, AppLocalDevData> {
    return structuredClone(this._appData);
  }

  getAppDataByUid(uid: string): AppLocalDevData | undefined {
    return { ...this._appData[uid] };
  }

  setAppDataForUid(uid: string, appData: AppLocalDevData): void {
    this._appData[uid] = appData;
    this.runListeners('appData');
  }

  get devServerMessage(): string {
    return this._devServerMessage;
  }

  set devServerMessage(message: LocalDevServerMessage) {
    this._devServerMessage = message;
    this.runListeners('devServerMessage');
  }

  get uploadWarnings(): Set<string> {
    return this._uploadWarnings;
  }

  addUploadWarning(warning: string): void {
    this.uploadWarnings.add(warning);
    this.runListeners('uploadWarnings');
  }

  clearUploadWarnings(): void {
    this.uploadWarnings.clear();
    this.runListeners('uploadWarnings');
  }

  addListener<K extends keyof LocalDevState>(
    key: K,
    listener: LocalDevStateListener<K>
  ): void {
    if (!this._listeners[key]) {
      this._listeners[key] = [];
    }
    this._listeners[key].push(listener);

    listener(this[key]);
  }

  removeListener<K extends keyof LocalDevState>(
    key: K,
    listener: LocalDevStateListener<K>
  ): void {
    if (this._listeners[key]) {
      this._listeners[key].splice(this._listeners[key].indexOf(listener), 1);
    }
  }
}

export default LocalDevState;
