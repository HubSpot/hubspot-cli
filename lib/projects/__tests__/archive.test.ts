import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  archiveDestExists,
  archiveProjectSource,
  getArchiveDest,
  getProjectArchiveDest,
  moveSourceToProjectArchive,
  restoreSourceFromProjectArchive,
} from '../archive.js';

function writeFile(root: string, relativePath: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, relativePath);
}

function listRootEntries(dir: string): string[] {
  return fs.readdirSync(dir).sort();
}

describe('lib/projects/archive', () => {
  let tmpDir: string;
  let projectDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-'));
    projectDir = path.join(tmpDir, 'my-project');
    fs.mkdirSync(projectDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('getArchiveDest()', () => {
    it('should return an archive directory inside the project when the source directory is nested', () => {
      expect(getArchiveDest(projectDir, 'src')).toBe(
        path.join(projectDir, 'archive')
      );
    });

    it('should return a sibling archive directory when the source directory is the project root', () => {
      expect(getArchiveDest(projectDir, '.')).toBe(
        path.join(tmpDir, 'my-project-archive')
      );
    });
  });

  describe('archiveDestExists()', () => {
    it('should return true when the archive directory exists', () => {
      fs.mkdirSync(path.join(projectDir, 'archive'));

      expect(archiveDestExists(path.join(projectDir, 'archive'))).toBe(true);
    });

    it('should return false when the archive directory does not exist', () => {
      expect(archiveDestExists(path.join(projectDir, 'archive'))).toBe(false);
    });
  });

  describe('archiveProjectSource()', () => {
    it('should move the source directory into the archive directory and return its path', () => {
      writeFile(projectDir, 'src/a.json');

      const archiveDest = archiveProjectSource(projectDir, 'src');

      expect(archiveDest).toBe(path.join(projectDir, 'archive'));
      expect(fs.existsSync(path.join(projectDir, 'src'))).toBe(false);
      expect(fs.existsSync(path.join(archiveDest, 'a.json'))).toBe(true);
    });

    it('should move the whole project to a sibling directory when the source directory is the project root', () => {
      writeFile(projectDir, 'a.json');

      const archiveDest = archiveProjectSource(projectDir, '.');

      expect(archiveDest).toBe(path.join(tmpDir, 'my-project-archive'));
      expect(fs.existsSync(projectDir)).toBe(false);
      expect(fs.existsSync(path.join(archiveDest, 'a.json'))).toBe(true);
    });
  });

  describe('getProjectArchiveDest()', () => {
    it('should return the archive directory in the project root', () => {
      expect(getProjectArchiveDest(projectDir)).toBe(
        path.join(projectDir, 'archive')
      );
    });
  });

  describe('moveSourceToProjectArchive()', () => {
    it('should move a nested source directory into the archive directory', () => {
      writeFile(projectDir, 'src/app/a.json');
      writeFile(projectDir, 'hsproject.json');

      const archiveDest = moveSourceToProjectArchive(projectDir, 'src');

      expect(archiveDest).toBe(path.join(projectDir, 'archive'));
      expect(listRootEntries(projectDir)).toEqual([
        'archive',
        'hsproject.json',
      ]);
      expect(fs.existsSync(path.join(archiveDest, 'app/a.json'))).toBe(true);
    });

    it('should move the project root entries into the archive directory when the source directory is the project root', () => {
      writeFile(projectDir, 'app/a.json');
      writeFile(projectDir, 'notes.md');

      const archiveDest = moveSourceToProjectArchive(projectDir, '.');

      expect(archiveDest).toBe(path.join(projectDir, 'archive'));
      expect(listRootEntries(projectDir)).toEqual(['archive']);
      expect(listRootEntries(archiveDest)).toEqual(['app', 'notes.md']);
    });

    it('should leave .git, node_modules, dist, and hsproject.json in place when the source directory is the project root', () => {
      writeFile(projectDir, '.git/HEAD');
      writeFile(projectDir, 'node_modules/pkg/index.js');
      writeFile(projectDir, 'dist/out.js');
      writeFile(projectDir, 'hsproject.json');
      writeFile(projectDir, 'app/a.json');

      const archiveDest = moveSourceToProjectArchive(projectDir, '.');

      expect(listRootEntries(projectDir)).toEqual([
        '.git',
        'archive',
        'dist',
        'hsproject.json',
        'node_modules',
      ]);
      expect(listRootEntries(archiveDest)).toEqual(['app']);
    });

    it('should roll back the entries it moved and remove the archive directory when a move fails', () => {
      writeFile(projectDir, 'a.json');
      writeFile(projectDir, 'b.json');
      const realRenameSync = fs.renameSync.bind(fs);
      const renameSpy = vi
        .spyOn(fs, 'renameSync')
        .mockImplementation((from, to) => {
          if (String(from).endsWith('b.json')) {
            throw new Error('EPERM');
          }
          realRenameSync(from, to);
        });

      expect(() => moveSourceToProjectArchive(projectDir, '.')).toThrow(
        'EPERM'
      );
      renameSpy.mockRestore();

      expect(listRootEntries(projectDir)).toEqual(['a.json', 'b.json']);
    });

    it('should throw without moving anything when the source directory is the archive directory', () => {
      writeFile(projectDir, 'archive/a.json');

      expect(() => moveSourceToProjectArchive(projectDir, 'archive')).toThrow(
        'cannot be the archive directory'
      );
      expect(fs.existsSync(path.join(projectDir, 'archive/a.json'))).toBe(true);
    });
  });

  describe('restoreSourceFromProjectArchive()', () => {
    it('should remove partially extracted source and copy the nested archive back into place', () => {
      writeFile(projectDir, 'archive/app/a.json');
      writeFile(projectDir, 'src/partial.json');

      restoreSourceFromProjectArchive(projectDir, 'src');

      expect(listRootEntries(projectDir)).toEqual(['archive', 'src']);
      expect(fs.existsSync(path.join(projectDir, 'src/app/a.json'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'src/partial.json'))).toBe(
        false
      );
    });

    it('should leave the archive untouched when restoring a nested source directory', () => {
      writeFile(projectDir, 'archive/app/a.json');
      writeFile(projectDir, 'archive/notes.md');
      writeFile(projectDir, 'src/partial.json');

      restoreSourceFromProjectArchive(projectDir, 'src');

      expect(listRootEntries(path.join(projectDir, 'archive'))).toEqual([
        'app',
        'notes.md',
      ]);
      expect(fs.existsSync(path.join(projectDir, 'archive/app/a.json'))).toBe(
        true
      );
    });

    it('should remove extracted entries and copy the archived entries back when the source directory is the project root', () => {
      writeFile(projectDir, 'archive/app/a.json');
      writeFile(projectDir, 'archive/notes.md');
      writeFile(projectDir, 'partial.json');

      restoreSourceFromProjectArchive(projectDir, '.');

      expect(listRootEntries(projectDir)).toEqual([
        'app',
        'archive',
        'notes.md',
      ]);
    });

    it('should leave the archive untouched when the source directory is the project root', () => {
      writeFile(projectDir, 'archive/app/a.json');
      writeFile(projectDir, 'archive/notes.md');

      restoreSourceFromProjectArchive(projectDir, '.');

      expect(listRootEntries(path.join(projectDir, 'archive'))).toEqual([
        'app',
        'notes.md',
      ]);
    });

    it('should not touch .git, node_modules, dist, or hsproject.json when the source directory is the project root', () => {
      writeFile(projectDir, '.git/HEAD');
      writeFile(projectDir, 'node_modules/pkg/index.js');
      writeFile(projectDir, 'dist/out.js');
      writeFile(projectDir, 'hsproject.json');
      writeFile(projectDir, 'archive/app/a.json');
      writeFile(projectDir, 'partial.json');

      restoreSourceFromProjectArchive(projectDir, '.');

      expect(listRootEntries(projectDir)).toEqual([
        '.git',
        'app',
        'archive',
        'dist',
        'hsproject.json',
        'node_modules',
      ]);
      expect(fs.existsSync(path.join(projectDir, '.git/HEAD'))).toBe(true);
    });

    it('should throw without deleting the nested source when the archive does not exist', () => {
      writeFile(projectDir, 'src/app/a.json');

      expect(() => restoreSourceFromProjectArchive(projectDir, 'src')).toThrow(
        'Archive directory not found'
      );
      expect(fs.existsSync(path.join(projectDir, 'src/app/a.json'))).toBe(true);
    });

    it('should throw without deleting any root entries when the archive does not exist and the source directory is the project root', () => {
      writeFile(projectDir, 'app/a.json');
      writeFile(projectDir, 'notes.md');

      expect(() => restoreSourceFromProjectArchive(projectDir, '.')).toThrow(
        'Archive directory not found'
      );
      expect(listRootEntries(projectDir)).toEqual(['app', 'notes.md']);
    });

    it('should throw without deleting the archive when the source directory is the archive directory', () => {
      writeFile(projectDir, 'archive/a.json');

      expect(() =>
        restoreSourceFromProjectArchive(projectDir, 'archive')
      ).toThrow('cannot be the archive directory');
      expect(fs.existsSync(path.join(projectDir, 'archive/a.json'))).toBe(true);
    });

    it('should throw without deleting the archive when the source directory is inside the archive directory', () => {
      writeFile(projectDir, 'archive/nested/a.json');

      expect(() =>
        restoreSourceFromProjectArchive(projectDir, 'archive/nested')
      ).toThrow('cannot be the archive directory');
      expect(
        fs.existsSync(path.join(projectDir, 'archive/nested/a.json'))
      ).toBe(true);
    });
  });
});
