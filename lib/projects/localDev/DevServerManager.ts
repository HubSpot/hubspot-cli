import AppDevModeInterface from './AppDevModeInterface.js';
import { lib } from '../../../lang/en.js';
import LocalDevState from './LocalDevState.js';
import LocalDevLogger from './LocalDevLogger.js';
import UIExtensionsDevModeInterface from './UIExtensionsDevModeInterface.js';

type DevServerInterface = {
  setup?: () => Promise<void>;
  start?: () => Promise<void>;
  fileChange?: (filePath: string, event: string) => Promise<void>;
  cleanup?: () => Promise<void>;
};

type DevServerManagerConstructorOptions = {
  localDevState: LocalDevState;
  logger: LocalDevLogger;
};

class DevServerManager {
  private initialized: boolean;
  private started: boolean;
  private devServers: DevServerInterface[];

  constructor(options: DevServerManagerConstructorOptions) {
    this.initialized = false;
    this.started = false;

    const AppsDevServer = new AppDevModeInterface({
      localDevState: options.localDevState,
      localDevLogger: options.logger,
    });

    const UIExtensionsDevServer = new UIExtensionsDevModeInterface({
      localDevState: options.localDevState,
    });

    this.devServers = [AppsDevServer, UIExtensionsDevServer];
  }

  private async iterateDevServers(
    callback: (serverInterface: DevServerInterface) => Promise<void>
  ): Promise<void> {
    await Promise.all(this.devServers.map(devServer => callback(devServer)));
  }

  async setup(): Promise<void> {
    for (const devServer of this.devServers) {
      if (devServer.setup) {
        // Run setup functions in order
        await devServer.setup();
      }
    }

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
    }
  }
}

export default DevServerManager;
