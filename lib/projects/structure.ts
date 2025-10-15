import * as fs from 'fs';
import * as path from 'path';
import { walk } from '@hubspot/local-dev-lib/fs';
import { uiLogger } from '../ui/logger.js';
import { logError } from '../errorHandlers/index.js';
import {
  ComponentTypes,
  Component,
  GenericComponentConfig,
  PublicAppComponentConfig,
  PrivateAppComponentConfig,
  AppCardComponentConfig,
} from '../../types/Projects.js';
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types.js';
import { AppIRNode } from '../../types/ProjectComponents.js';
import {
  IR_COMPONENT_TYPES,
  LEGACY_PRIVATE_APP_FILE,
  LEGACY_PUBLIC_APP_FILE,
  THEME_FILE,
} from '../constants.js';

export const CONFIG_FILES: {
  [k in ComponentTypes]: string;
} = {
  [ComponentTypes.PrivateApp]: LEGACY_PRIVATE_APP_FILE,
  [ComponentTypes.PublicApp]: LEGACY_PUBLIC_APP_FILE,
  [ComponentTypes.HublTheme]: THEME_FILE,
};

export function getComponentTypeFromConfigFile(
  configFile: string
): ComponentTypes | null {
  let key: ComponentTypes;
  for (key in CONFIG_FILES) {
    if (CONFIG_FILES[key] === configFile) {
      return key;
    }
  }
  return null;
}

export function loadConfigFile(
  configPath: string
): GenericComponentConfig | null {
  if (configPath) {
    try {
      const source = fs.readFileSync(configPath);
      const parsedConfig = JSON.parse(source.toString());
      return parsedConfig;
    } catch (e) {
      uiLogger.debug(e);
    }
  }
  return null;
}

export function getAppCardConfigs(
  appConfig: PublicAppComponentConfig | PrivateAppComponentConfig,
  appPath: string
): Array<AppCardComponentConfig> {
  const cardConfigs: Array<AppCardComponentConfig> = [];
  let cards;

  if (appConfig && appConfig.extensions && appConfig.extensions.crm) {
    cards = appConfig.extensions.crm.cards;
  }

  if (cards) {
    cards.forEach(({ file }: { file?: string }) => {
      if (typeof file === 'string') {
        const cardConfigPath = path.join(appPath, file);
        const cardConfig = loadConfigFile(cardConfigPath);

        if (cardConfig && 'type' in cardConfig) {
          cardConfigs.push(cardConfig);
        }
      }
    });
  }

  return cardConfigs;
}

export function getIsLegacyApp(
  appConfig: GenericComponentConfig,
  appPath: string
): boolean {
  let hasAnyReactExtensions = false;

  if (appConfig && 'extensions' in appConfig) {
    const cardConfigs = getAppCardConfigs(appConfig, appPath);

    if (!cardConfigs.length) {
      // Assume any app that does not have any cards is not legacy
      return false;
    }

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
  }

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
      const parsedConfig = loadConfigFile(projectFile);

      if (parsedConfig) {
        const isLegacy = getIsLegacyApp(parsedConfig, dir);
        const isHublTheme = base === CONFIG_FILES[ComponentTypes.HublTheme];
        const componentType = getComponentTypeFromConfigFile(base);

        if (componentType) {
          components.push({
            type: componentType,
            config: parsedConfig,
            runnable: !isLegacy && !isHublTheme,
            path: dir,
          });
        }
      }
    }
  });

  return components;
}

export function getProjectComponentTypes(components: Array<Component>): {
  [key in ComponentTypes]?: boolean;
} {
  const projectContents: { [key in ComponentTypes]?: boolean } = {};

  components.forEach(({ type }) => (projectContents[type] = true));
  return projectContents;
}

export function getComponentUid(component?: Component | null): string | null {
  if (!component) {
    return null;
  } else if ('uid' in component.config) {
    return component.config.uid;
  } else {
    return component.config.data.uid;
  }
}

export function componentIsApp(
  component?: Component | null
): component is Component<
  PublicAppComponentConfig | PrivateAppComponentConfig
> {
  return (
    component?.type === ComponentTypes.PublicApp ||
    component?.type === ComponentTypes.PrivateApp
  );
}

export function componentIsPublicApp(
  component?: Component | null
): component is Component<PublicAppComponentConfig> {
  return component?.type === ComponentTypes.PublicApp;
}

export function isAppIRNode(
  component: IntermediateRepresentationNodeLocalDev
): component is AppIRNode {
  return component.componentType === IR_COMPONENT_TYPES.APPLICATION;
}
