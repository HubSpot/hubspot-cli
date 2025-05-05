import path from 'path';
import chokidar, { FSWatcher } from 'chokidar';

import { PROJECT_CONFIG_FILE } from '../../constants';
import LocalDevProcess from './LocalDevProcess';

const WATCH_EVENTS = {
  add: 'add',
  change: 'change',
  unlink: 'unlink',
  unlinkDir: 'unlinkDir',
};

class LocalDevWatcher {
  private localDevProcess: LocalDevProcess;
  private watcher: FSWatcher | null;

  constructor(localDevProcess: LocalDevProcess) {
    this.localDevProcess = localDevProcess;
    this.watcher = null;
  }

  private handleWatchEvent(
    filePath: string,
    event: string,
    configPaths: string[]
  ): void {
    if (configPaths.includes(filePath)) {
      this.localDevProcess.logger.uploadWarning();
    } else {
      this.localDevProcess.handleFileChange(filePath, event);
    }
  }

  start(): void {
    this.watcher = chokidar.watch(this.localDevProcess.projectDir, {
      ignoreInitial: true,
    });

    const configPaths = Object.values(this.localDevProcess.projectNodes).map(
      component => component.localDev.componentConfigPath
    );

    const projectConfigPath = path.join(
      this.localDevProcess.projectDir,
      PROJECT_CONFIG_FILE
    );
    configPaths.push(projectConfigPath);

    this.watcher.on('add', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.add, configPaths);
    });
    this.watcher.on('change', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.change, configPaths);
    });
    this.watcher.on('unlink', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.unlink, configPaths);
    });
    this.watcher.on('unlinkDir', filePath => {
      this.handleWatchEvent(filePath, WATCH_EVENTS.unlinkDir, configPaths);
    });
  }

  async stop(): Promise<void> {
    await this.watcher?.close();
  }
}

export default LocalDevWatcher;
