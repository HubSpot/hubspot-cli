import path from 'path';
import fs from 'fs';
import { Collision } from '@hubspot/local-dev-lib/types/Archive';
import { coerceToValidUid } from '@hubspot/project-parsing-lib/uid';
import {
  METAFILE_EXTENSION as metafileExtension,
  APP_KEY as AppKey,
} from '@hubspot/project-parsing-lib/constants';
import type { ProjectMetadata } from '@hubspot/project-parsing-lib/projects';
import { fileExists } from '../validation.js';
import { uiLogger } from '../ui/logger.js';
import { lib } from '../../lang/en.js';
import { debugError } from '../errorHandlers/index.js';
import { uiLink } from '../ui/index.js';
import chalk from 'chalk';
import { renderInline } from '../../ui/render.js';
import { getSuccessBox } from '../../ui/components/StatusMessageBoxes.js';

// Prefix for the metafile extension
const metafileExtensionPrefix = path.parse(metafileExtension).name;

export interface ComponentInfo {
  filename?: string;
  isNew: boolean;
}

export type ComponentsByType = Map<string, ComponentInfo[]>;

export function buildProjectTree(
  projectName: string,
  uids: string[],
  componentsByType: ComponentsByType,
  showOnlyNew: boolean
): string {
  const lines: string[] = [];
  lines.push(chalk.bold(projectName));
  const types = Array.from(componentsByType.keys());

  for (const uid of uids) {
    lines.push(`├─ [app] ${uid}`);

    for (let i = 0; i < types.length; i++) {
      const type = types[i];
      const allComponents = componentsByType.get(type) || [];
      const components = showOnlyNew
        ? allComponents.filter(c => c.isNew)
        : allComponents;

      if (components.length === 0) continue;

      const isLastType = i === types.length - 1;
      const typePrefix = isLastType ? '│  └─' : '│  ├─';
      const typeConnector = isLastType ? '   ' : '│  ';
      lines.push(`${typePrefix} ${type}`);

      for (let j = 0; j < components.length; j++) {
        const component = components[j];
        const isLastComponent = j === components.length - 1;
        const componentPrefix = isLastComponent ? '└─' : '├─';
        const addedLabel = component.isNew ? chalk.green(' (added)') : '';
        lines.push(
          `│  ${typeConnector}${componentPrefix} ${component.filename}${addedLabel}`
        );
      }
    }
  }

  return lines.join('\n');
}

function buildSuccessMessage(
  projectName: string,
  uids: string[],
  componentsByType: ComponentsByType,
  newComponentsCount: number,
  showOnlyNew: boolean,
  isProjectEmpty?: boolean,
  projectDest?: string
): string {
  const messages = lib.projects.components.buildSuccessMessage;
  const tree = buildProjectTree(
    projectName,
    uids,
    componentsByType,
    showOnlyNew
  );

  const featureText = `${newComponentsCount} feature${newComponentsCount > 1 ? 's' : ''}`;
  const uid = uids.length === 1 ? uids[0] : projectName;

  const docsLink = uiLink(messages.seeOurDocs, messages.docsUrl);

  const header = projectDest
    ? messages.headerCreated(projectName, projectDest)
    : messages.headerAdded(featureText, uid, newComponentsCount > 1);

  // Use \n\n between sections to create gaps, \n within sections for no gaps
  const sections = [
    header,
    isProjectEmpty ? null : tree,
    messages.docsDetails(docsLink),
    `${messages.uploadPrompt}\n${messages.devPrompt}`,
  ].filter(Boolean);

  return sections.join('\n\n');
}

function applyDifferentiatorToFilename(
  filename: string,
  differentiator: number,
  isHsMetaFile: boolean
): string {
  const { name, ext, dir } = path.parse(filename);
  if (isHsMetaFile) {
    return path.join(
      dir,
      `${name.replace(metafileExtensionPrefix, '')}-${differentiator}${metafileExtension}`
    );
  }
  return path.join(dir, `${name}-${differentiator}${ext}`);
}

// Generates safe filename differentiators, avoiding collisions with existing filenames
// E.x. "NewCard.tsx" -> "NewCard-1.tsx"
function generateSafeFilenameDifferentiator(
  sourceFiles: string[],
  hsMetaFiles: string[]
): number {
  let differentiator = 1;
  let isDifferentiatorUnique = false;
  let maxAttempts = 10;

  while (!isDifferentiatorUnique) {
    differentiator++;
    maxAttempts--;

    try {
      const isDifferentiatorUniqueForSourceFiles = sourceFiles.every(file => {
        return !fileExists(
          applyDifferentiatorToFilename(file, differentiator, false)
        );
      });

      const isDifferentiatorUniqueForHsMetaFiles = hsMetaFiles.every(file => {
        return !fileExists(
          applyDifferentiatorToFilename(file, differentiator, true)
        );
      });

      isDifferentiatorUnique =
        isDifferentiatorUniqueForSourceFiles &&
        isDifferentiatorUniqueForHsMetaFiles;
    } catch (error) {
      uiLogger.debug(
        lib.projects.generateSafeFilenameDifferentiator.failedToCheckFiles
      );
      maxAttempts = 0;
    }

    // If we've tried too many times, just use a timestamp
    if (maxAttempts <= 0) {
      return Date.now();
    }
  }
  return differentiator;
}

// Handles a collision between component source files
export function handleComponentCollision({ dest, src, collisions }: Collision) {
  const hsMetaFiles: string[] = [];
  const packageJsonFiles: string[] = [];
  const sourceFiles: string[] = [];

  collisions.forEach(collision => {
    if (collision.endsWith(metafileExtension)) {
      hsMetaFiles.push(collision);
    } else if (path.parse(collision).base === 'package.json') {
      packageJsonFiles.push(collision);
    } else {
      sourceFiles.push(collision);
    }
  });

  const filenameDifferentiator = generateSafeFilenameDifferentiator(
    sourceFiles,
    hsMetaFiles
  );

  // Exclude markdown files fromthe rename process because they should not be duplicated
  const sourceFilenameMapping: Record<string, string> = sourceFiles
    .filter(filename => !filename.endsWith('.md'))
    .reduce((acc, filename) => {
      return {
        ...acc,
        [filename]: applyDifferentiatorToFilename(
          filename,
          filenameDifferentiator,
          false
        ),
      };
    }, {});

  const metaFilenameMapping: Record<string, string> = hsMetaFiles.reduce(
    (acc, filename) => {
      return {
        ...acc,
        [filename]: applyDifferentiatorToFilename(
          filename,
          filenameDifferentiator,
          true
        ),
      };
    },
    {}
  );

  // Update the metafiles that might contain references to the old filenames
  hsMetaFiles.forEach(file => {
    updateMetaFile({
      dest,
      src,
      file,
      sourceFilenameMapping,
      metaFilenameMapping,
    });
  });

  // Copy the renamed files into their new destination location
  Object.entries(sourceFilenameMapping).forEach(([key, value]) => {
    fs.copyFileSync(path.join(src, key), path.join(dest, value));
  });

  if (packageJsonFiles.length) {
    handlePackageJsonCollisions(dest, src, packageJsonFiles);
  }
}

function updateMetaFile({
  dest,
  src,
  file,
  sourceFilenameMapping,
  metaFilenameMapping,
}: {
  dest: string;
  src: string;
  file: string;
  sourceFilenameMapping: Record<string, string>;
  metaFilenameMapping: Record<string, string>;
}) {
  let text = fs.readFileSync(path.join(src, file), 'utf-8');
  Object.entries(sourceFilenameMapping).forEach(([key, value]) => {
    const { base: oldFileName } = path.parse(key);
    const { base: newFileName } = path.parse(value);
    text = text.replace(oldFileName, newFileName);
  });
  fs.writeFileSync(path.join(dest, metaFilenameMapping[file]), text);
}

function handlePackageJsonCollisions(
  dest: string,
  src: string,
  packageJsonFiles: string[]
) {
  packageJsonFiles.forEach(file => {
    const existingPackageJsonContents = JSON.parse(
      fs.readFileSync(path.join(dest, file), 'utf-8')
    );

    const newPackageJsonContents = JSON.parse(
      fs.readFileSync(path.join(src, file), 'utf-8')
    );
    existingPackageJsonContents.dependencies = {
      ...newPackageJsonContents.dependencies,
      ...existingPackageJsonContents.dependencies,
    };

    existingPackageJsonContents.devDependencies = {
      ...newPackageJsonContents.devDependencies,
      ...existingPackageJsonContents.devDependencies,
    };

    fs.writeFileSync(
      path.join(dest, file),
      JSON.stringify(existingPackageJsonContents, null, 2)
    );
  });
}

export async function updateHsMetaFilesWithAutoGeneratedFields(
  projectName: string,
  hsMetaFilePaths: string[],
  existingUids: string[] = [],
  options?: {
    currentProjectMetadata?: ProjectMetadata;
    updatedProjectMetadata?: ProjectMetadata;
    showSuccessMessage?: boolean;
    isProjectEmpty?: boolean;
    projectDest?: string;
  }
) {
  for (const hsMetaFile of hsMetaFilePaths) {
    try {
      const component = JSON.parse(fs.readFileSync(hsMetaFile).toString());

      const getBaseUid = () => {
        const customUid = coerceToValidUid(`${projectName}_${component.type}`);

        if (customUid) {
          return customUid.replace(/-/g, '_');
        }
        return component.uid;
      };

      let uid = getBaseUid();

      let differentiator = 1;
      while (existingUids.includes(uid)) {
        differentiator++;
        uid = `${getBaseUid()}_${differentiator}`;
      }

      component.uid = uid;

      if (component.type === AppKey && component.config) {
        component.config.name = `${projectName}-App`;
      }

      fs.writeFileSync(hsMetaFile, JSON.stringify(component, null, 2));
    } catch (error) {
      debugError(error);
      uiLogger.error(
        lib.projects.updateHsMetaFilesWithAutoGeneratedFields.failedToUpdate(
          hsMetaFile
        )
      );
    }
  }

  if (options?.showSuccessMessage && options?.updatedProjectMetadata) {
    const {
      currentProjectMetadata,
      updatedProjectMetadata,
      isProjectEmpty,
      projectDest,
    } = options;

    const uids: string[] = [];
    const updatedAppsMetadata = updatedProjectMetadata.components[AppKey];

    // Get UID(s) from -hsmeta.json files
    if (updatedAppsMetadata?.hsMetaFiles) {
      updatedAppsMetadata.hsMetaFiles.forEach(appLocation => {
        try {
          const appConfig = JSON.parse(fs.readFileSync(appLocation, 'utf-8'));
          uids.push(appConfig.uid || 'unknown app'); // fallback to unknown app incase we can't get uid
        } catch (err) {
          uiLogger.debug(lib.projects.components.unableToGetUidFromHsmeta);
        }
      });
    }

    // Fallback if no app hsmeta files found or all failed to parse
    if (uids.length === 0) {
      uids.push('unknown app');
    }

    const componentsByType: ComponentsByType = new Map();

    const addComponent = (hsMetaPath: string, isNew: boolean) => {
      const type = path.basename(path.dirname(hsMetaPath));
      const existing = componentsByType.get(type) || [];
      existing.push({ filename: path.basename(hsMetaPath), isNew });
      componentsByType.set(type, existing);
    };

    // Add new files
    hsMetaFilePaths.forEach(hsMetaFile => addComponent(hsMetaFile, true));

    if (currentProjectMetadata) {
      Object.entries(currentProjectMetadata.components)
        .filter(([type, metadata]) => type !== AppKey && metadata.count > 0)
        .flatMap(([, metadata]) => metadata.hsMetaFiles)
        .forEach(hsMetaFile => addComponent(hsMetaFile, false));
    }

    const newComponentsCount = hsMetaFilePaths.length;
    const successMessage = buildSuccessMessage(
      projectName,
      uids,
      componentsByType,
      newComponentsCount,
      false,
      isProjectEmpty,
      projectDest
    );
    await renderInline(
      getSuccessBox({ title: 'SUCCESS', message: successMessage })
    );
  }
}
