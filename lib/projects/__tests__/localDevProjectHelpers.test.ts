import fs from 'fs-extra';
import os from 'os';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Mock } from 'vitest';
import { downloadProject } from '@hubspot/local-dev-lib/api/projects';
import { extractZipArchive } from '@hubspot/local-dev-lib/archive';
import { isDeepEqual } from '@hubspot/local-dev-lib/isDeepEqual';
import {
  translate,
  type IntermediateRepresentationNodeLocalDev,
} from '@hubspot/project-parsing-lib/translate';
import { ProjectConfig } from '../../../types/Projects.js';
import { isDeployedProjectUpToDateWithLocal } from '../localDev/helpers/project.js';

// Mock all external dependencies
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/archive');
vi.mock('@hubspot/project-parsing-lib/translate');
vi.mock('@hubspot/local-dev-lib/isDeepEqual');
vi.mock('fs-extra');
vi.mock('../../utils/isDeepEqual.js');

describe('isDeployedProjectUpToDateWithLocal', () => {
  const mockProjectName = 'test-project';
  const mockAccountId = 123456;
  const mockBuildId = 789;
  const mockProjectConfig: ProjectConfig = {
    name: mockProjectName,
    srcDir: 'src',
    platformVersion: '1.0.0',
  };

  const mockLocalNode: IntermediateRepresentationNodeLocalDev = {
    uid: 'component1',
    componentType: 'APP',
    localDev: {
      componentRoot: '/local/path',
      componentConfigPath: '/local/path/config.json',
      configUpdatedSinceLastUpload: false,
      removed: false,
      parsingErrors: [],
    },
    componentDeps: {},
    metaFilePath: '/local/path',
    config: { name: 'Component 1' },
    files: [],
  };

  const mockLocalProjectNodes = {
    component1: mockLocalNode,
  };

  const mockTempDir = '/tmp/test-temp-dir';
  const mockZippedProject = Buffer.from('fake-zip-data');

  beforeEach(() => {
    // Mock fs.mkdtemp
    (fs.mkdtemp as unknown as Mock).mockResolvedValue(mockTempDir);

    // Mock fs.pathExists - return true for hsproject.json
    (fs.pathExists as Mock).mockResolvedValue(true);

    // Mock fs.readJson to return deployed project config
    (fs.readJson as Mock).mockResolvedValue({
      srcDir: 'src',
      platformVersion: '1.0.0',
    });

    // Mock fs.remove
    (fs.remove as Mock).mockResolvedValue(undefined);

    // Mock os.tmpdir
    vi.spyOn(os, 'tmpdir').mockReturnValue('/tmp');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when projects are identical', () => {
    it('should return true for identical projects', async () => {
      // Mock downloadProject
      (downloadProject as Mock).mockResolvedValue({
        data: mockZippedProject,
      });

      // Mock extractZipArchive
      (extractZipArchive as Mock).mockResolvedValue(undefined);

      // Mock translate to return identical nodes
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: mockLocalProjectNodes,
      });

      // Mock isDeepEqual to return true for identical projects
      (isDeepEqual as Mock).mockReturnValue(true);

      const result = await isDeployedProjectUpToDateWithLocal(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toBe(true);
      expect(isDeepEqual).toHaveBeenCalledWith(
        mockLocalProjectNodes,
        mockLocalProjectNodes,
        ['localDev']
      );
      expect(fs.remove).toHaveBeenCalledWith(mockTempDir);
    });
  });

  describe('when projects are different', () => {
    it('should return false for different projects', async () => {
      // Mock downloadProject
      (downloadProject as Mock).mockResolvedValue({
        data: mockZippedProject,
      });

      // Mock extractZipArchive
      (extractZipArchive as Mock).mockResolvedValue(undefined);

      // Mock translate to return different nodes
      const differentDeployedNodes = {};
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: differentDeployedNodes,
      });

      // Mock isDeepEqual to return false for different projects
      (isDeepEqual as Mock).mockReturnValue(false);

      const result = await isDeployedProjectUpToDateWithLocal(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toBe(false);
      expect(isDeepEqual).toHaveBeenCalledWith(
        mockLocalProjectNodes,
        differentDeployedNodes,
        ['localDev']
      );
    });
  });

  describe('error handling', () => {
    it('should clean up temp directory even when errors occur', async () => {
      // Mock downloadProject to throw an error after temp dir is created
      (downloadProject as Mock).mockRejectedValue(new Error('Download Error'));

      const result = await isDeployedProjectUpToDateWithLocal(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toBe(false);
      expect(fs.remove).toHaveBeenCalledWith(mockTempDir);
    });

    it('should handle translateForLocalDev errors', async () => {
      // Mock downloadProject
      (downloadProject as Mock).mockResolvedValue({
        data: mockZippedProject,
      });

      // Mock extractZipArchive
      (extractZipArchive as Mock).mockResolvedValue(undefined);

      // Mock translate to throw an error
      (translate as Mock).mockRejectedValue(new Error('Translation Error'));

      const result = await isDeployedProjectUpToDateWithLocal(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toBe(false);
      expect(fs.remove).toHaveBeenCalledWith(mockTempDir);
    });

    it('should default to "src" when hsproject.json has no srcDir field', async () => {
      // Mock downloadProject
      (downloadProject as Mock).mockResolvedValue({
        data: mockZippedProject,
      });

      // Mock extractZipArchive
      (extractZipArchive as Mock).mockResolvedValue(undefined);

      // Mock fs.readJson to return config without srcDir
      (fs.readJson as Mock).mockResolvedValue({
        platformVersion: '1.0.0',
      });

      // Mock translate to return nodes
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: mockLocalProjectNodes,
      });

      // Mock isDeepEqual to return true
      (isDeepEqual as Mock).mockReturnValue(true);

      const result = await isDeployedProjectUpToDateWithLocal(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toBe(true);
      // Verify translate was called with "src" as the srcDir
      expect(translate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectSourceDir: `${mockTempDir}/src`,
        }),
        expect.anything()
      );
    });
  });
});
