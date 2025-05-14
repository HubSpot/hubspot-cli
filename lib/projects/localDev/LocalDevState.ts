import { Build } from '@hubspot/local-dev-lib/types/Build';
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { ProjectConfig } from '../../../types/Projects';
import {
  LocalDevStateConstructorOptions,
  LocalDevStateListener,
} from '../../../types/LocalDev';

class LocalDevState {
  private _targetProjectAccountId: number;
  private _targetTestingAccountId: number;
  private _projectConfig: ProjectConfig;
  private _projectDir: string;
  private _projectId: number;
  private _debug: boolean;
  private _deployedBuild?: Build;
  private _isGithubLinked: boolean;
  private _projectNodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  };
  private _env: Environment;
  private _listeners: {
    [key in keyof LocalDevState]?: LocalDevStateListener<key>[];
  };

  constructor({
    targetProjectAccountId,
    targetTestingAccountId,
    projectConfig,
    projectDir,
    projectId,
    debug,
    deployedBuild,
    isGithubLinked,
    initialProjectNodes,
    env,
  }: LocalDevStateConstructorOptions) {
    this._targetProjectAccountId = targetProjectAccountId;
    this._targetTestingAccountId = targetTestingAccountId;
    this._projectConfig = projectConfig;
    this._projectDir = projectDir;
    this._projectId = projectId;
    this._debug = debug || false;
    this._deployedBuild = deployedBuild;
    this._isGithubLinked = isGithubLinked;
    this._projectNodes = initialProjectNodes;
    this._env = env;

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

  get projectConfig(): ProjectConfig {
    return {
      ...this._projectConfig,
    };
  }

  get projectDir(): string {
    return this._projectDir;
  }

  get projectId(): number {
    return this._projectId;
  }

  get debug(): boolean {
    return this._debug;
  }

  get deployedBuild(): Build | undefined {
    return (
      this._deployedBuild && {
        ...this._deployedBuild,
      }
    );
  }

  get isGithubLinked(): boolean {
    return this._isGithubLinked;
  }

  get projectNodes(): {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  } {
    return { ...this._projectNodes };
  }

  set projectNodes(nodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  }) {
    this._projectNodes = nodes;
    this.runListeners('projectNodes');
  }

  get env(): Environment {
    return this._env;
  }

  addListener<K extends keyof LocalDevState>(
    key: K,
    listener: LocalDevStateListener<K>
  ): void {
    if (!this._listeners[key]) {
      this._listeners[key] = [];
    }
    this._listeners[key].push(listener);
  }
}

export default LocalDevState;
