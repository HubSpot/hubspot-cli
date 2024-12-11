import * as fs from 'fs';
import * as path from 'path';
import { walk } from '@hubspot/local-dev-lib/fs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from './errorHandlers/index';

export type ComponentType = 'private-app' | 'public-app' | 'hubl-theme';
type ValueOf<T> = T[keyof T];

export type Component = {
  type: ComponentType;
  config: object;
  runnable: boolean;
  path: string;
};

export const COMPONENT_TYPES = {
  privateApp: 'private-app',
  publicApp: 'public-app',
  hublTheme: 'hubl-theme',
} as const;

export const CONFIG_FILES: {
  [k in ValueOf<typeof COMPONENT_TYPES>]: string;
} = {
  [COMPONENT_TYPES.privateApp]: 'app.json',
  [COMPONENT_TYPES.publicApp]: 'public-app.json',
  [COMPONENT_TYPES.hublTheme]: 'theme.json',
};

function getTypeFromConfigFile(
  configFile: ValueOf<typeof CONFIG_FILES>
): ComponentType | null {
  let key: ComponentType;
  for (key in CONFIG_FILES) {
    if (CONFIG_FILES[key] === configFile) {
      return key;
    }
  }
  return null;
}

function loadConfigFile(configPath: string) {
  if (configPath) {
    try {
      const source = fs.readFileSync(configPath);
      const parsedConfig = JSON.parse(source.toString());
      return parsedConfig;
    } catch (e) {
      logger.debug(e);
    }
  }
  return null;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
export function getAppCardConfigs(appConfig: any, appPath: string) {
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const cardConfigs: Array<any> = [];
  let cards;

  if (appConfig && appConfig.extensions && appConfig.extensions.crm) {
    cards = appConfig.extensions.crm.cards;
  }

  if (cards) {
    cards.forEach(({ file }: { file?: string }) => {
      if (typeof file === 'string') {
        const cardConfigPath = path.join(appPath, file);
        const cardConfig = loadConfigFile(cardConfigPath);

        if (cardConfig) {
          cardConfigs.push(cardConfig);
        }
      }
    });
  }

  return cardConfigs;
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any */
function getIsLegacyApp(appConfig: any, appPath: string) {
  const cardConfigs = getAppCardConfigs(appConfig, appPath);

  if (!cardConfigs.length) {
    // Assume any app that does not have any cards is not legacy
    return false;
  }

  let hasAnyReactExtensions = false;

  cardConfigs.forEach(cardConfig => {
    if (!hasAnyReactExtensions) {
      const isReactExtension =
        cardConfig &&
        !!cardConfig.data &&
        !!cardConfig.data.module &&
        !!cardConfig.data.module.file;

      hasAnyReactExtensions = isReactExtension;
    }
  });

  return !hasAnyReactExtensions;
}

export async function findProjectComponents(
  projectSourceDir: string
): Promise<Array<Component>> {
  const components: Array<Component> = [];
  let projectFiles: Array<string> = [];

  try {
    projectFiles = await walk(projectSourceDir);
  } catch (e) {
    logError(e);
  }

  projectFiles.forEach(projectFile => {
    // Find app components
    const { base, dir } = path.parse(projectFile);

    if (Object.values(CONFIG_FILES).includes(base)) {
      const parsedAppConfig = loadConfigFile(projectFile);

      if (parsedAppConfig) {
        const isLegacy = getIsLegacyApp(parsedAppConfig, dir);
        const isHublTheme = base === CONFIG_FILES[COMPONENT_TYPES.hublTheme];
        const type = getTypeFromConfigFile(base);

        if (type) {
          components.push({
            type,
            config: parsedAppConfig,
            runnable: !isLegacy && !isHublTheme,
            path: dir,
          });
        }
      }
    }
  });

  return components;
}

export function getProjectComponentTypes(components: Array<Component>) {
  const projectContents: { [key in ComponentType]?: boolean } = {};

  components.forEach(({ type }) => (projectContents[type] = true));
  return projectContents;
}
