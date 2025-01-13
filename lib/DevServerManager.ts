import { logger } from '@hubspot/local-dev-lib/logger';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import {
  COMPONENT_TYPES,
  ComponentTypes,
  Component,
} from './projects/structure';
import { i18n } from './lang';
import { promptUser } from './prompts/promptUtils';
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
import { ProjectConfig } from '../types/Projects';

const i18nKey = 'lib.DevServerManager';

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
  [key in ComponentTypes]: { [key: string]: Component };
};

class DevServerManager {
  private initialized: boolean;
  private started: boolean;
  private componentsByType: ComponentsByType;
  private devServers: { [key in ServerKey]: DevServer };

  constructor() {
    this.initialized = false;
    this.started = false;
    this.componentsByType = {
      [COMPONENT_TYPES.privateApp]: {},
      [COMPONENT_TYPES.publicApp]: {},
      [COMPONENT_TYPES.hublTheme]: {},
    };
    this.devServers = {
      [SERVER_KEYS.privateApp]: {
        componentType: COMPONENT_TYPES.privateApp,
        serverInterface: UIEDevModeInterface,
      },
      [SERVER_KEYS.publicApp]: {
        componentType: COMPONENT_TYPES.publicApp,
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
        logger.debug(i18n(`${i18nKey}.noCompatibleComponents`, { serverKey }));
      }
    }
  }

  arrangeComponentsByType(components: Component[]): ComponentsByType {
    return components.reduce((acc, component) => {
      if (!acc[component.type]) {
        acc[component.type] = {};
      }

      if ('name' in component.config && component.config.name) {
        acc[component.type][component.config.name] = component;
      }

      return acc;
    }, {} as ComponentsByType);
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
      throw new Error(i18n(`${i18nKey}.notInitialized`));
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

export default new DevServerManager();
