import archiver from 'archiver';
import fs from 'fs-extra';
import path from 'path';
import crypto from 'crypto';
import { shouldIgnoreFile } from '@hubspot/local-dev-lib/ignoreRules';
import {
  getPackableFiles,
  WorkspaceMapping,
  FileDependencyMapping,
} from '@hubspot/project-parsing-lib/workspaces';
import { uiLogger } from '../ui/logger.js';
import { lib } from '../../lang/en.js';

/**
 * Result of archiving workspaces and file dependencies
 */
export type WorkspaceArchiveResult = {
  packageWorkspaces: Map<string, string[]>;
  packageFileDeps: Map<string, Map<string, string>>;
};

/**
 * Generates a short hash of the input string for use in workspace paths.
 * Uses SHA256 truncated to 8 hex characters (4 billion possibilities).
 */
export function shortHash(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, 8);
}

/**
 * Determines the archive path for an external workspace or file: dependency.
 * Produces `_workspaces/<basename>-<hash>` with no subdirectory.
 * The hash prevents collisions between different directories with the same basename.
 */
export function computeExternalArchivePath(absolutePath: string): string {
  const resolved = path.resolve(absolutePath);
  const name = path.basename(resolved);
  return path.join('_workspaces', `${name}-${shortHash(resolved)}`);
}

/**
 * Returns true if dir is inside srcDir (i.e. it will already be included
 * in the archive from the srcDir walk and must not be copied again).
 */
function isInsideSrcDir(dir: string, srcDir: string): boolean {
  const rel = path.relative(path.resolve(srcDir), path.resolve(dir));
  return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * Creates a file filter function for workspace archiving.
 * Filters files based on packable files list and ignore rules.
 */
function createWorkspaceFileFilter(
  packableFiles: Set<string>
): (file: archiver.EntryData) => false | archiver.EntryData {
  return (file: archiver.EntryData) => {
    if (packableFiles.size > 0 && !packableFiles.has(file.name)) {
      uiLogger.debug(
        lib.projectUpload.handleProjectUpload.fileFiltered(file.name)
      );
      return false;
    }
    const ignored = shouldIgnoreFile(file.name, true);
    if (ignored) {
      uiLogger.debug(
        lib.projectUpload.handleProjectUpload.fileFiltered(file.name)
      );
      return false;
    }
    return file;
  };
}

/**
 * Archives workspace directories and returns mapping information.
 *
 * Internal workspaces (inside srcDir) are not archived — they are already
 * included via the srcDir walk. Their relative paths (from the package.json
 * directory to the workspace directory) are stored directly in the entries.
 *
 * External workspaces (outside srcDir) are copied to `_workspaces/<name>-<hash>`
 * and their relative archive paths (e.g. `../_workspaces/<name>-<hash>`) are stored.
 */
async function archiveWorkspaceDirectories(
  archive: archiver.Archiver,
  srcDir: string,
  workspaceMappings: WorkspaceMapping[]
): Promise<{
  externalArchivePaths: Map<string, string>;
  packageWorkspaceEntries: Map<string, string[]>;
}> {
  const externalArchivePaths = new Map<string, string>(); // resolvedDir -> archivePath
  const archivePathToDir = new Map<string, string>(); // archivePath -> resolvedDir (collision detection)
  const packageWorkspaceEntries = new Map<string, string[]>();
  const externalsToArchive: Array<{ dir: string; archivePath: string }> = [];

  for (const mapping of workspaceMappings) {
    const { workspaceDir, sourcePackageJsonPath } = mapping;

    if (!packageWorkspaceEntries.has(sourcePackageJsonPath)) {
      packageWorkspaceEntries.set(sourcePackageJsonPath, []);
    }

    if (isInsideSrcDir(workspaceDir, srcDir)) {
      // Internal: already in archive from srcDir walk.
      // Store the relative path from the package.json directory so npm can resolve it.
      const relPath = path.relative(
        path.dirname(sourcePackageJsonPath),
        path.resolve(workspaceDir)
      );
      packageWorkspaceEntries.get(sourcePackageJsonPath)!.push(relPath);
    } else {
      // External: archive to _workspaces/<name>-<hash>.
      const archivePath = computeExternalArchivePath(workspaceDir);
      const resolvedDir = path.resolve(workspaceDir);

      // Detect hash collisions (different dirs mapping to the same archive path)
      const existing = archivePathToDir.get(archivePath);
      if (existing && existing !== resolvedDir) {
        throw new Error(
          lib.projectUpload.handleProjectUpload.workspaceCollision(
            archivePath,
            workspaceDir,
            existing
          )
        );
      }

      if (!externalArchivePaths.has(resolvedDir)) {
        externalArchivePaths.set(resolvedDir, archivePath);
        archivePathToDir.set(archivePath, resolvedDir);
        externalsToArchive.push({ dir: workspaceDir, archivePath });
      }

      const relPkgJsonDir = path.relative(
        srcDir,
        path.dirname(sourcePackageJsonPath)
      );
      const relativeEntry = path.relative(relPkgJsonDir, archivePath);
      packageWorkspaceEntries.get(sourcePackageJsonPath)!.push(relativeEntry);
    }
  }

  // Fetch packable files in parallel (I/O optimization)
  const withPackableFiles = await Promise.all(
    externalsToArchive.map(async item => ({
      ...item,
      packableFiles: await getPackableFiles(item.dir),
    }))
  );

  // Archive directories sequentially (archiver requires sequential operations)
  for (const { dir, archivePath, packableFiles } of withPackableFiles) {
    uiLogger.log(
      lib.projectUpload.handleProjectUpload.workspaceIncluded(dir, archivePath)
    );
    archive.directory(
      dir,
      archivePath,
      createWorkspaceFileFilter(packableFiles)
    );
  }

  return { externalArchivePaths, packageWorkspaceEntries };
}

/**
 * Archives file: dependencies and returns mapping information.
 *
 * Internal file: dependencies (inside srcDir) are skipped — their original
 * `file:` references in package.json remain valid after upload.
 *
 * External file: dependencies are archived to `_workspaces/<name>-<hash>`
 * and tracked in the returned map so package.json can be rewritten.
 */
async function archiveFileDependencies(
  archive: archiver.Archiver,
  srcDir: string,
  fileDependencyMappings: FileDependencyMapping[],
  externalArchivePaths: Map<string, string>
): Promise<Map<string, Map<string, string>>> {
  const packageFileDeps = new Map<string, Map<string, string>>();
  const toArchive: Array<{
    localPath: string;
    archivePath: string;
    packageName: string;
  }> = [];

  for (const mapping of fileDependencyMappings) {
    const { packageName, localPath, sourcePackageJsonPath } = mapping;

    if (isInsideSrcDir(localPath, srcDir)) {
      // Internal: original file: reference stays unchanged, nothing to do
      continue;
    }

    // External: archive to _workspaces/<name>-<hash>
    const archivePath = computeExternalArchivePath(localPath);
    const resolvedPath = path.resolve(localPath);

    if (!packageFileDeps.has(sourcePackageJsonPath)) {
      packageFileDeps.set(sourcePackageJsonPath, new Map());
    }
    const relPkgJsonDir = path.relative(
      srcDir,
      path.dirname(sourcePackageJsonPath)
    );
    const relativeArchivePath = path.relative(relPkgJsonDir, archivePath);
    packageFileDeps
      .get(sourcePackageJsonPath)!
      .set(packageName, relativeArchivePath);

    // Only archive each unique path once
    if (!externalArchivePaths.has(resolvedPath)) {
      externalArchivePaths.set(resolvedPath, archivePath);
      toArchive.push({ localPath, archivePath, packageName });
    }
  }

  // Fetch packable files in parallel (I/O optimization)
  const withPackableFiles = await Promise.all(
    toArchive.map(async item => ({
      ...item,
      packableFiles: await getPackableFiles(item.localPath),
    }))
  );

  // Archive directories sequentially (archiver requires sequential operations)
  for (const {
    localPath,
    archivePath,
    packageName,
    packableFiles,
  } of withPackableFiles) {
    uiLogger.log(
      lib.projectUpload.handleProjectUpload.fileDependencyIncluded(
        packageName,
        localPath,
        archivePath
      )
    );
    archive.directory(
      localPath,
      archivePath,
      createWorkspaceFileFilter(packableFiles)
    );
  }

  return packageFileDeps;
}

/**
 * Updates package.json files in the archive to reflect new workspace and file: dependency paths.
 *
 * Workspace entries in packageWorkspaces are already in final form:
 * - Internal workspaces: relative paths (e.g. "../packages/utils")
 * - External workspaces: relative paths (e.g. "../_workspaces/logger-abc")
 *
 * Only external file: dependencies appear in packageFileDeps; internal ones
 * keep their original file: references and are left untouched.
 */
export async function updatePackageJsonInArchive(
  archive: archiver.Archiver,
  srcDir: string,
  packageWorkspaces: Map<string, string[]>,
  packageFileDeps: Map<string, Map<string, string>>
): Promise<void> {
  // Collect all package.json paths that need updating
  const allPackageJsonPaths = new Set([
    ...packageWorkspaces.keys(),
    ...packageFileDeps.keys(),
  ]);

  for (const packageJsonPath of allPackageJsonPaths) {
    if (!fs.existsSync(packageJsonPath)) {
      continue;
    }

    const relativePackageJsonPath = path.relative(srcDir, packageJsonPath);

    let rawContent: string;
    try {
      rawContent = fs.readFileSync(packageJsonPath, 'utf8');
    } catch {
      continue;
    }

    let packageJson;
    try {
      packageJson = JSON.parse(rawContent);
    } catch (e) {
      uiLogger.warn(
        lib.projectUpload.handleProjectUpload.malformedPackageJson(
          packageJsonPath,
          e instanceof Error ? e.message : String(e)
        )
      );
      archive.append(rawContent, { name: relativePackageJsonPath });
      continue;
    }

    let modified = false;

    // Update workspaces field — entries are already in their final form
    const workspaceEntries = packageWorkspaces.get(packageJsonPath);
    if (workspaceEntries && packageJson.workspaces) {
      packageJson.workspaces = workspaceEntries;
      modified = true;

      uiLogger.debug(
        lib.projectUpload.handleProjectUpload.updatingPackageJsonWorkspaces(
          relativePackageJsonPath
        )
      );
      uiLogger.debug(
        lib.projectUpload.handleProjectUpload.updatedWorkspaces(
          workspaceEntries.join(', ')
        )
      );
    }

    // Update external file: dependencies; internal ones are left untouched
    const fileDeps = packageFileDeps.get(packageJsonPath);
    if (fileDeps && fileDeps.size > 0 && packageJson.dependencies) {
      for (const [packageName, archivePath] of fileDeps.entries()) {
        if (packageJson.dependencies[packageName]?.startsWith('file:')) {
          packageJson.dependencies[packageName] = `file:${archivePath}`;
          modified = true;

          uiLogger.debug(
            lib.projectUpload.handleProjectUpload.updatedFileDependency(
              packageName,
              archivePath
            )
          );
        }
      }
    }

    archive.append(
      modified ? JSON.stringify(packageJson, null, 2) : rawContent,
      { name: relativePackageJsonPath }
    );
  }

  // Ensure all append operations are queued before finalize is called
  // Use setImmediate to yield control and let archiver process the queue
  await new Promise<void>(resolve => setImmediate(resolve));
}

export function rewriteLockfileForExternalDeps(
  lockfileContent: Record<string, unknown>,
  pathMappings: Array<{ oldPath: string; newPath: string }>
): Record<string, unknown> {
  if (pathMappings.length === 0) {
    return lockfileContent;
  }

  const packages = lockfileContent.packages as
    | Record<string, unknown>
    | undefined;
  if (!packages) {
    return lockfileContent;
  }

  const newPackages: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(packages)) {
    const mapping = pathMappings.find(m => m.oldPath === key);
    newPackages[mapping ? mapping.newPath : key] = value;
  }

  for (const [key, value] of Object.entries(newPackages)) {
    if (
      key.startsWith('node_modules/') &&
      typeof value === 'object' &&
      value !== null
    ) {
      const entry = value as Record<string, unknown>;
      if (entry.link === true && typeof entry.resolved === 'string') {
        const mapping = pathMappings.find(m => m.oldPath === entry.resolved);
        if (mapping) {
          newPackages[key] = { ...entry, resolved: mapping.newPath };
        }
      }
    }
  }

  const rootEntry = newPackages[''];
  if (rootEntry && typeof rootEntry === 'object' && rootEntry !== null) {
    const root = rootEntry as Record<string, unknown>;
    if (Array.isArray(root.workspaces)) {
      newPackages[''] = {
        ...root,
        workspaces: root.workspaces.map((ws: unknown) => {
          if (typeof ws !== 'string') return ws;
          const mapping = pathMappings.find(m => m.oldPath === ws);
          return mapping ? mapping.newPath : ws;
        }),
      };
    }
  }

  return { ...lockfileContent, packages: newPackages };
}

export function getPackageJsonPathsToUpdate(
  srcDir: string,
  workspaceMappings: WorkspaceMapping[],
  fileDependencyMappings: FileDependencyMapping[]
): Set<string> {
  const paths = new Set<string>();

  for (const { sourcePackageJsonPath } of workspaceMappings) {
    paths.add(path.relative(srcDir, sourcePackageJsonPath));
  }

  for (const { localPath, sourcePackageJsonPath } of fileDependencyMappings) {
    if (!isInsideSrcDir(localPath, srcDir)) {
      paths.add(path.relative(srcDir, sourcePackageJsonPath));
    }
  }

  return paths;
}

function getDirsWithExternalDeps(
  srcDir: string,
  workspaceMappings: WorkspaceMapping[],
  fileDependencyMappings: FileDependencyMapping[]
): Set<string> {
  const dirs = new Set<string>();
  for (const { workspaceDir, sourcePackageJsonPath } of workspaceMappings) {
    if (!isInsideSrcDir(workspaceDir, srcDir)) {
      dirs.add(path.dirname(sourcePackageJsonPath));
    }
  }
  for (const { localPath, sourcePackageJsonPath } of fileDependencyMappings) {
    if (!isInsideSrcDir(localPath, srcDir)) {
      dirs.add(path.dirname(sourcePackageJsonPath));
    }
  }
  return dirs;
}

export function getLockfilePathsToUpdate(
  srcDir: string,
  workspaceMappings: WorkspaceMapping[],
  fileDependencyMappings: FileDependencyMapping[]
): Set<string> {
  const dirsWithExternalDeps = getDirsWithExternalDeps(
    srcDir,
    workspaceMappings,
    fileDependencyMappings
  );
  const paths = new Set<string>();
  for (const dir of dirsWithExternalDeps) {
    const lockfilePath = path.join(dir, 'package-lock.json');
    if (fs.existsSync(lockfilePath)) {
      paths.add(path.relative(srcDir, lockfilePath));
    }
  }
  return paths;
}

async function rewriteLockfilesInArchive(
  archive: archiver.Archiver,
  srcDir: string,
  externalArchivePaths: Map<string, string>,
  dirsWithExternalDeps: Set<string>
): Promise<void> {
  if (externalArchivePaths.size === 0) return;
  for (const dir of dirsWithExternalDeps) {
    const lockfilePath = path.join(dir, 'package-lock.json');
    if (!fs.existsSync(lockfilePath)) continue;
    let rawContent: string;
    try {
      rawContent = fs.readFileSync(lockfilePath, 'utf8');
    } catch {
      continue;
    }
    let lockfileContent: Record<string, unknown>;
    try {
      lockfileContent = JSON.parse(rawContent);
    } catch {
      continue;
    }
    const pathMappings: Array<{ oldPath: string; newPath: string }> = [];
    for (const [absoluteExternalPath, archivePath] of externalArchivePaths) {
      pathMappings.push({
        oldPath: path.relative(dir, absoluteExternalPath),
        newPath: path.relative(dir, path.join(srcDir, archivePath)),
      });
    }
    const rewritten = rewriteLockfileForExternalDeps(
      lockfileContent,
      pathMappings
    );
    const relativeLockfilePath = path.relative(srcDir, lockfilePath);
    uiLogger.debug(
      lib.projectUpload.handleProjectUpload.updatingLockfile(
        relativeLockfilePath
      )
    );
    archive.append(JSON.stringify(rewritten, null, 2), {
      name: relativeLockfilePath,
    });
  }
  await new Promise<void>(resolve => setImmediate(resolve));
}

/**
 * Main orchestration function that handles archiving of workspaces and file dependencies.
 * This is the clean integration point for upload.ts.
 */
export async function archiveWorkspacesAndDependencies(
  archive: archiver.Archiver,
  srcDir: string,
  projectDir: string,
  workspaceMappings: WorkspaceMapping[],
  fileDependencyMappings: FileDependencyMapping[]
): Promise<WorkspaceArchiveResult> {
  // Archive workspace directories (internal ones are skipped, externals are copied)
  const { externalArchivePaths, packageWorkspaceEntries } =
    await archiveWorkspaceDirectories(archive, srcDir, workspaceMappings);

  // Archive external file: dependencies (internals are skipped)
  const packageFileDeps = await archiveFileDependencies(
    archive,
    srcDir,
    fileDependencyMappings,
    externalArchivePaths
  );

  // Update package.json files with new paths
  await updatePackageJsonInArchive(
    archive,
    srcDir,
    packageWorkspaceEntries,
    packageFileDeps
  );

  // Rewrite lock files to point to archive paths for external deps
  const dirsWithExternalDeps = getDirsWithExternalDeps(
    srcDir,
    workspaceMappings,
    fileDependencyMappings
  );
  await rewriteLockfilesInArchive(
    archive,
    srcDir,
    externalArchivePaths,
    dirsWithExternalDeps
  );

  return { packageWorkspaces: packageWorkspaceEntries, packageFileDeps };
}
