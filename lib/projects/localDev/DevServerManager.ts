import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { logger } from '@hubspot/local-dev-lib/logger';
import { promptUser } from '../../prompts/promptUtils';
import { DevModeInterface as UIEDevModeInterface } from '@hubspot/ui-extensions-dev-server';
import {
  startPortManagerServer,
  stopPortManagerServer,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import {
  getHubSpotApiOrigin,
  getHubSpotWebsiteOrigin,
} from '@hubspot/local-dev-lib/urls';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import {
  ProjectConfig,
  ComponentTypes,
  Component,
} from '../../../types/Projects';
import { lib } from '../../../lang/en';
import { uiLogger } from '../../ui/logger';

const SERVER_KEYS = {
  privateApp: 'privateApp',
  publicApp: 'publicApp',
} as const;

type ServerKey = keyof typeof SERVER_KEYS;

type DevServerInterface = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  setup?: Function;
  start?: (options: object) => Promise<void>;
  fileChange?: (filePath: string, event: string) => Promise<void>;
  cleanup?: () => Promise<void>;
};

type DevServer = {
  componentType: ComponentTypes;
  serverInterface: DevServerInterface;
};

type ComponentsByType = {
  [key in ComponentTypes]?: { [key: string]: Component };
};

class DevServerManager {
  private initialized: boolean;
  private started: boolean;
  private componentsByType: ComponentsByType;
  private devServers: { [key in ServerKey]: DevServer };

  constructor() {
    this.initialized = false;
    this.started = false;
    this.componentsByType = {};
    this.devServers = {
      [SERVER_KEYS.privateApp]: {
        componentType: ComponentTypes.PrivateApp,
        serverInterface: UIEDevModeInterface,
      },
      [SERVER_KEYS.publicApp]: {
        componentType: ComponentTypes.PublicApp,
        serverInterface: UIEDevModeInterface,
      },
    };
  }

  async iterateDevServers(
    callback: (
      serverInterface: DevServerInterface,
      compatibleComponents: {
        [key: string]: Component;
      }
    ) => Promise<void>
  ): Promise<void> {
    const serverKeys: ServerKey[] = Object.keys(this.devServers) as ServerKey[];

    for (let i = 0; i < serverKeys.length; i++) {
      const serverKey = serverKeys[i];
      const devServer = this.devServers[serverKey];

      const compatibleComponents =
        this.componentsByType[devServer.componentType] || {};

      if (Object.keys(compatibleComponents).length) {
        await callback(devServer.serverInterface, compatibleComponents);
      } else {
        uiLogger.debug(lib.DevServerManager.noCompatibleComponents(serverKey));
      }
    }
  }

  arrangeComponentsByType(components: Component[]): ComponentsByType {
    return components.reduce<ComponentsByType>((acc, component) => {
      if (!acc[component.type]) {
        acc[component.type] = {};
      }

      if ('name' in component.config && component.config.name) {
        acc[component.type]![component.config.name] = component;
      }

      return acc;
    }, {});
  }

  async setup({
    components,
    onUploadRequired,
    accountId,
    setActiveApp,
  }: {
    components: Component[];
    onUploadRequired: () => void;
    accountId: number;
    setActiveApp: (appUid: string | undefined) => Promise<void>;
  }): Promise<void> {
    this.componentsByType = this.arrangeComponentsByType(components);
    let env: Environment;
    const accountConfig = getAccountConfig(accountId);
    if (accountConfig) {
      env = accountConfig.env;
    }
    await startPortManagerServer();
    await this.iterateDevServers(
      async (serverInterface, compatibleComponents) => {
        if (serverInterface.setup) {
          await serverInterface.setup({
            components: compatibleComponents,
            onUploadRequired,
            promptUser,
            logger,
            urls: {
              api: getHubSpotApiOrigin(env),
              web: getHubSpotWebsiteOrigin(env),
            },
            setActiveApp,
          });
        }
      }
    );

    this.initialized = true;
  }

  async start({
    accountId,
    projectConfig,
  }: {
    accountId: number;
    projectConfig: ProjectConfig;
  }): Promise<void> {
    if (this.initialized) {
      await this.iterateDevServers(async serverInterface => {
        if (serverInterface.start) {
          await serverInterface.start({
            accountId,
            projectConfig,
            requestPorts,
          });
        }
      });
    } else {
      throw new Error(lib.DevServerManager.notInitialized);
    }

    this.started = true;
  }

  async fileChange({
    filePath,
    event,
  }: {
    filePath: string;
    event: string;
  }): Promise<void> {
    if (this.started) {
      this.iterateDevServers(async serverInterface => {
        if (serverInterface.fileChange) {
          await serverInterface.fileChange(filePath, event);
        }
      });
    }
  }

  async cleanup(): Promise<void> {
    if (this.started) {
      await this.iterateDevServers(async serverInterface => {
        if (serverInterface.cleanup) {
          await serverInterface.cleanup();
        }
      });

      await stopPortManagerServer();
    }
  }
}

const Manager = new DevServerManager();

export default Manager;
