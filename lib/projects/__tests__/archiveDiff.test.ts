import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  copyArchivedFilesToSource,
  getFilesOnlyInArchive,
  writeArchiveDiffFile,
} from '../archiveDiff.js';

function writeFile(root: string, relativePath: string): void {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, 'content');
}

describe('lib/projects/archiveDiff', () => {
  let projectDir: string;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archive-diff-'));
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  describe('getFilesOnlyInArchive()', () => {
    it('should return files that exist in the archive but not in the downloaded source', async () => {
      writeFile(projectDir, 'archive/app/app-hsmeta.json');
      writeFile(projectDir, 'archive/app/local-notes.md');
      writeFile(projectDir, 'src/app/app-hsmeta.json');

      const files = await getFilesOnlyInArchive(projectDir, 'src');

      expect(files).toEqual(['app/local-notes.md']);
    });

    it('should not return files that only exist in the downloaded source', async () => {
      writeFile(projectDir, 'archive/a.json');
      writeFile(projectDir, 'src/a.json');
      writeFile(projectDir, 'src/new.json');

      const files = await getFilesOnlyInArchive(projectDir, 'src');

      expect(files).toEqual([]);
    });

    it('should ignore node_modules and dist directories at any depth', async () => {
      writeFile(projectDir, 'archive/node_modules/pkg/index.js');
      writeFile(projectDir, 'archive/dist/bundle.js');
      writeFile(projectDir, 'archive/app/functions/node_modules/pkg/index.js');
      writeFile(projectDir, 'archive/app/functions/dist/out.js');
      writeFile(projectDir, 'archive/app/functions/handler.js');
      fs.mkdirSync(path.join(projectDir, 'src'));

      const files = await getFilesOnlyInArchive(projectDir, 'src');

      expect(files).toEqual(['app/functions/handler.js']);
    });

    it('should not ignore directories whose names only contain node_modules or dist', async () => {
      writeFile(projectDir, 'archive/distribution/readme.md');
      writeFile(projectDir, 'archive/node_modules_backup/a.js');
      fs.mkdirSync(path.join(projectDir, 'src'));

      const files = await getFilesOnlyInArchive(projectDir, 'src');

      expect(files).toEqual([
        'distribution/readme.md',
        'node_modules_backup/a.js',
      ]);
    });

    it('should return every archived file when the downloaded source directory does not exist', async () => {
      writeFile(projectDir, 'archive/a.json');

      const files = await getFilesOnlyInArchive(projectDir, 'src');

      expect(files).toEqual(['a.json']);
    });

    it('should compare the archive against the project root, ignoring the archive directory itself, when the source directory is the project root', async () => {
      writeFile(projectDir, 'archive/keep.json');
      writeFile(projectDir, 'archive/old.json');
      writeFile(projectDir, 'keep.json');

      const files = await getFilesOnlyInArchive(projectDir, '.');

      expect(files).toEqual(['old.json']);
    });
  });

  describe('writeArchiveDiffFile()', () => {
    it('should write every file as a JSON array to diff.json in the archive directory and return its path', () => {
      const archiveDest = path.join(projectDir, 'archive');
      fs.mkdirSync(archiveDest);

      const diffFilePath = writeArchiveDiffFile(archiveDest, [
        'app/a.md',
        'b.js',
      ]);

      expect(diffFilePath).toBe(path.join(archiveDest, 'diff.json'));
      expect(JSON.parse(fs.readFileSync(diffFilePath, 'utf-8'))).toEqual([
        'app/a.md',
        'b.js',
      ]);
    });

    it('should throw when the archive directory does not exist', () => {
      expect(() =>
        writeArchiveDiffFile(path.join(projectDir, 'missing'), ['a.md'])
      ).toThrow();
    });
  });

  describe('copyArchivedFilesToSource()', () => {
    it('should copy files from the archive into the source directory and keep the archived copies', () => {
      writeFile(projectDir, 'archive/notes.md');
      fs.mkdirSync(path.join(projectDir, 'src'));

      const result = copyArchivedFilesToSource(projectDir, 'src', ['notes.md']);

      expect(result).toEqual({ copiedCount: 1, failures: [] });
      expect(fs.existsSync(path.join(projectDir, 'src/notes.md'))).toBe(true);
      expect(fs.existsSync(path.join(projectDir, 'archive/notes.md'))).toBe(
        true
      );
    });

    it('should recreate directories that do not exist in the source directory', () => {
      writeFile(projectDir, 'archive/app/functions/deep/handler.js');
      fs.mkdirSync(path.join(projectDir, 'src'));

      const result = copyArchivedFilesToSource(projectDir, 'src', [
        'app/functions/deep/handler.js',
      ]);

      expect(result.copiedCount).toBe(1);
      expect(
        fs.existsSync(
          path.join(projectDir, 'src/app/functions/deep/handler.js')
        )
      ).toBe(true);
    });

    it('should preserve file contents', () => {
      writeFile(projectDir, 'archive/notes.md');
      fs.mkdirSync(path.join(projectDir, 'src'));

      copyArchivedFilesToSource(projectDir, 'src', ['notes.md']);

      expect(
        fs.readFileSync(path.join(projectDir, 'src/notes.md'), 'utf-8')
      ).toBe('content');
    });

    it('should copy into the project root when the source directory is the project root', () => {
      writeFile(projectDir, 'archive/app/a.md');

      const result = copyArchivedFilesToSource(projectDir, '.', ['app/a.md']);

      expect(result.copiedCount).toBe(1);
      expect(fs.existsSync(path.join(projectDir, 'app/a.md'))).toBe(true);
    });

    it('should not overwrite a file that already exists in the source directory', () => {
      writeFile(projectDir, 'archive/notes.md');
      fs.mkdirSync(path.join(projectDir, 'src'));
      fs.writeFileSync(path.join(projectDir, 'src/notes.md'), 'new content');

      const result = copyArchivedFilesToSource(projectDir, 'src', ['notes.md']);

      expect(result.copiedCount).toBe(0);
      expect(result.failures).toHaveLength(1);
      expect(
        fs.readFileSync(path.join(projectDir, 'src/notes.md'), 'utf-8')
      ).toBe('new content');
    });

    it('should report failures and keep copying the remaining files', () => {
      writeFile(projectDir, 'archive/a.md');
      writeFile(projectDir, 'archive/c.md');
      fs.mkdirSync(path.join(projectDir, 'src'));

      const result = copyArchivedFilesToSource(projectDir, 'src', [
        'a.md',
        'missing.md',
        'c.md',
      ]);

      expect(result.copiedCount).toBe(2);
      expect(result.failures.map(({ file }) => file)).toEqual(['missing.md']);
      expect(fs.existsSync(path.join(projectDir, 'src/c.md'))).toBe(true);
    });
  });
});
