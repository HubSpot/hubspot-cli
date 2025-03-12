import { logger } from '@hubspot/local-dev-lib/logger';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { i18n } from './lang';
import { promptUser } from './prompts/promptUtils';
import { DevModeUnifiedInterface as UIEDevModeInterface } from '@hubspot/ui-extensions-dev-server';
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
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types';

const i18nKey = 'lib.DevServerManager';

type DevServerInterface = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  setup?: Function;
  start?: (options: object) => Promise<void>;
  fileChange?: (filePath: string, event: string) => Promise<void>;
  cleanup?: () => Promise<void>;
};

class DevServerManagerV2 {
  private initialized: boolean;
  private started: boolean;
  private devServers: DevServerInterface[];

  constructor() {
    this.initialized = false;
    this.started = false;
    this.devServers = [UIEDevModeInterface];
  }

  async iterateDevServers(
    callback: (serverInterface: DevServerInterface) => Promise<void>
  ): Promise<void> {
    await Promise.all(this.devServers.map(devServer => callback(devServer)));
  }

  async setup({
    components,
    onUploadRequired,
    accountId,
    setActiveApp,
  }: {
    components: { [key: string]: IntermediateRepresentationNodeLocalDev };
    onUploadRequired: () => void;
    accountId: number;
    setActiveApp: (appUid: string | undefined) => Promise<void>;
  }): Promise<void> {
    let env: Environment;
    const accountConfig = getAccountConfig(accountId);
    if (accountConfig) {
      env = accountConfig.env;
    }
    await startPortManagerServer();
    await this.iterateDevServers(async serverInterface => {
      if (serverInterface.setup) {
        await serverInterface.setup({
          components: components,
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
    });

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

const Manager = new DevServerManagerV2();

export default Manager;
