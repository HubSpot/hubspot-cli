import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { logger } from '@hubspot/local-dev-lib/logger';
import { promptUser } from '../../prompts/promptUtils';
import {
  startPortManagerServer,
  stopPortManagerServer,
} from '@hubspot/local-dev-lib/portManager';
import {
  getHubSpotApiOrigin,
  getHubSpotWebsiteOrigin,
} from '@hubspot/local-dev-lib/urls';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import AppDevModeInterface from './AppDevModeInterface';
import { lib } from '../../../lang/en';
import { LocalDevState } from '../../../types/LocalDev';
import LocalDevLogger from './LocalDevLogger';

type DevServerInterface = {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  setup?: Function;
  start?: () => Promise<void>;
  fileChange?: (filePath: string, event: string) => Promise<void>;
  cleanup?: () => Promise<void>;
};

type DevServerManagerV2ConstructorOptions = {
  localDevState: LocalDevState;
  logger: LocalDevLogger;
};

class DevServerManagerV2 {
  private initialized: boolean;
  private started: boolean;
  private devServers: DevServerInterface[];
  private localDevState: LocalDevState;

  constructor(options: DevServerManagerV2ConstructorOptions) {
    this.initialized = false;
    this.started = false;
    this.localDevState = options.localDevState;

    const AppsDevServer = new AppDevModeInterface({
      localDevState: options.localDevState,
      localDevLogger: options.logger,
    });
    this.devServers = [AppsDevServer];
  }

  async iterateDevServers(
    callback: (serverInterface: DevServerInterface) => Promise<void>
  ): Promise<void> {
    await Promise.all(this.devServers.map(devServer => callback(devServer)));
  }

  async setup(): Promise<void> {
    let env: Environment;
    const accountConfig = getAccountConfig(
      this.localDevState.targetTestingAccountId
    );
    if (accountConfig) {
      env = accountConfig.env;
    }
    await startPortManagerServer();
    await this.iterateDevServers(async serverInterface => {
      if (serverInterface.setup) {
        await serverInterface.setup({
          promptUser,
          logger,
          urls: {
            api: getHubSpotApiOrigin(env),
            web: getHubSpotWebsiteOrigin(env),
          },
        });
      }
    });

    this.initialized = true;
  }

  async start(): Promise<void> {
    if (this.initialized) {
      await this.iterateDevServers(async serverInterface => {
        if (serverInterface.start) {
          await serverInterface.start();
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

export default DevServerManagerV2;
