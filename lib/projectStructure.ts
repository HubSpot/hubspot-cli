import * as fs from 'fs';
import * as path from 'path';
import { walk } from '@hubspot/local-dev-lib/fs';
import { logger } from '@hubspot/local-dev-lib/logger';
import { logError } from './errorHandlers/index';

type ComponentTypes = 'private-app' | 'public-app' | 'hubl-theme';
type ValueOf<T> = T[keyof T];

export type Component = {
  type: ComponentTypes;
  config: object;
  runnable: boolean;
  path: string;
};

type PrivateAppComponentConfigType = {
  name: string;
  description: string;
  uid: string;
  scopes: Array<string>;
  public: boolean;
  extensions?: {
    crm: {
      cards: Array<{ file: string }>;
    };
  };
};

type PublicAppComponentConfigType = {
  name: string;
  uid: string;
  description: string;
  allowedUrls: Array<string>;
  auth: {
    redirectUrls: Array<string>;
    requiredScopes: Array<string>;
    optionalScopes: Array<string>;
    conditionallyRequiredScopes: Array<string>;
  };
  support: {
    supportEmail: string;
    documentationUrl: string;
    supportUrl: string;
    supportPhone: string;
  };
  extensions?: {
    crm: {
      cards: Array<{ file: string }>;
    };
  };
  webhooks?: {
    file: string;
  };
};

type AppCardComponentConfigType = {
  type: 'crm-card';
  data: {
    title: string;
    uid: string;
    location: string;
    module: {
      file: string;
    };
    objectTypes: Array<{ name: string }>;
  };
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
): ComponentTypes | null {
  let key: ComponentTypes;
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

export function getAppCardConfigs(
  appConfig: PublicAppComponentConfigType | PrivateAppComponentConfigType,
  appPath: string
) {
  const cardConfigs: Array<AppCardComponentConfigType> = [];
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

function getIsLegacyApp(
  appConfig: PublicAppComponentConfigType | PrivateAppComponentConfigType,
  appPath: string
) {
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
  const projectContents: { [key in ComponentTypes]?: boolean } = {};

  components.forEach(({ type }) => (projectContents[type] = true));
  return projectContents;
}
