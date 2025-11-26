import path from 'path';
import fs from 'fs';
import { Collision } from '@hubspot/local-dev-lib/types/Archive';
import {
  coerceToValidUid,
  metafileExtension,
} from '@hubspot/project-parsing-lib';
import { fileExists } from '../validation.js';
import { uiLogger } from '../ui/logger.js';
import { AppKey } from '@hubspot/project-parsing-lib/src/lib/constants.js';
import { lib } from '../../lang/en.js';
import { debugError } from '../errorHandlers/index.js';

// Prefix for the metafile extension
const metafileExtensionPrefix = path.parse(metafileExtension).name;

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

export function updateHsMetaFilesWithAutoGeneratedFields(
  projectName: string,
  hsMetaFilePaths: string[],
  existingUids: string[] = []
) {
  uiLogger.log('');
  uiLogger.log(lib.projects.updateHsMetaFilesWithAutoGeneratedFields.header);
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
        component.config.name = `${projectName}-Application`;
        uiLogger.log(
          lib.projects.updateHsMetaFilesWithAutoGeneratedFields.applicationLog(
            component.type,
            component.uid,
            component.config.name
          )
        );
      } else {
        uiLogger.log(
          lib.projects.updateHsMetaFilesWithAutoGeneratedFields.componentLog(
            component.type,
            component.uid
          )
        );
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
  uiLogger.log('');
}
