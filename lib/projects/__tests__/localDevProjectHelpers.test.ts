import path from 'path';
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
import {
  type LocallyChangedComponents,
  type ProjectConfig,
} from '../../../types/Projects.js';
import { getLocallyChangedComponents } from '../localDev/helpers/project.js';

const emptyChanged: LocallyChangedComponents = {
  added: [],
  updated: [],
  removed: [],
};

// Mock all external dependencies
vi.mock('@hubspot/local-dev-lib/api/projects');
vi.mock('@hubspot/local-dev-lib/archive');
vi.mock('@hubspot/project-parsing-lib/translate');
vi.mock('@hubspot/local-dev-lib/isDeepEqual');
vi.mock('fs-extra');
vi.mock('../../utils/isDeepEqual.js');

describe('getLocallyChangedComponents', () => {
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
    metaFilePath: 'app-hsmeta.json',
    config: { name: 'Component 1' },
    files: [],
  };

  const mockLocalProjectNodes = {
    component1: mockLocalNode,
  };

  const mockTempDir = '/tmp/test-temp-dir';
  const mockZippedProject = Buffer.from('fake-zip-data');

  beforeEach(() => {
    (fs.mkdtemp as unknown as Mock).mockResolvedValue(mockTempDir);
    (fs.pathExists as Mock).mockResolvedValue(true);
    (fs.readJson as Mock).mockResolvedValue({
      srcDir: 'src',
      platformVersion: '1.0.0',
    });
    (fs.remove as Mock).mockResolvedValue(undefined);
    vi.spyOn(os, 'tmpdir').mockReturnValue('/tmp');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when projects are identical', () => {
    it('should return empty changed components for identical projects', async () => {
      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: mockLocalProjectNodes,
      });
      (isDeepEqual as Mock).mockReturnValue(true);

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toEqual(emptyChanged);
      expect(isDeepEqual).toHaveBeenCalledWith(mockLocalNode, mockLocalNode, [
        'localDev',
        'componentDeps',
      ]);
      expect(fs.remove).toHaveBeenCalledWith(mockTempDir);
    });
  });

  describe('when projects are different', () => {
    it('should return added path for a node only present locally', async () => {
      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: {},
      });

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toEqual({
        added: [
          path.join(mockProjectConfig.srcDir, mockLocalNode.metaFilePath),
        ],
        updated: [],
        removed: [],
      });
    });

    it('should return removed path for a node only present in deployed', async () => {
      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: mockLocalProjectNodes,
      });

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        {}
      );

      expect(result).toEqual({
        added: [],
        updated: [],
        removed: [
          path.join(mockProjectConfig.srcDir, mockLocalNode.metaFilePath),
        ],
      });
    });

    it('should return updated path for a node that differs', async () => {
      const deployedNode = { ...mockLocalNode, config: { name: 'Changed' } };
      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: { component1: deployedNode },
      });
      (isDeepEqual as Mock).mockReturnValue(false);

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toEqual({
        added: [],
        updated: [
          path.join(mockProjectConfig.srcDir, mockLocalNode.metaFilePath),
        ],
        removed: [],
      });
    });
  });

  describe('auto-generated component filtering', () => {
    it('should filter auto-generated nodes from local nodes before comparison', async () => {
      const autoGeneratedLocalNode: IntermediateRepresentationNodeLocalDev = {
        uid: 'serverless-pkg',
        componentType: 'SERVERLESS_PACKAGE',
        localDev: {
          componentRoot: '/local/pkg',
          componentConfigPath: '/local/pkg/config.json',
          configUpdatedSinceLastUpload: false,
          removed: false,
          parsingErrors: [],
        },
        componentDeps: {},
        metaFilePath: 'serverless-package-hsmeta.json',
        config: { name: 'Serverless Package' },
        files: [],
      };
      const localNodesWithAutoGenerated = {
        component1: mockLocalNode,
        'serverless-pkg': autoGeneratedLocalNode,
      };

      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: mockLocalProjectNodes,
      });
      (isDeepEqual as Mock).mockReturnValue(true);

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        localNodesWithAutoGenerated
      );

      expect(result).toEqual(emptyChanged);
      expect(isDeepEqual).toHaveBeenCalledWith(mockLocalNode, mockLocalNode, [
        'localDev',
        'componentDeps',
      ]);
      expect(isDeepEqual).not.toHaveBeenCalledWith(
        autoGeneratedLocalNode,
        expect.anything(),
        expect.anything()
      );
    });

    it('should filter auto-generated nodes from deployed nodes before comparison', async () => {
      const autoGeneratedDeployedNode = {
        uid: 'serverless-pkg',
        componentType: 'SERVERLESS_PACKAGE',
        componentDeps: {},
        metaFilePath: 'serverless-package-hsmeta.json',
        config: { name: 'Serverless Package' },
        files: [],
      };
      const deployedNodesWithAutoGenerated = {
        component1: mockLocalNode,
        'serverless-pkg': autoGeneratedDeployedNode,
      };

      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: deployedNodesWithAutoGenerated,
      });
      (isDeepEqual as Mock).mockReturnValue(true);

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toEqual(emptyChanged);
      expect(isDeepEqual).toHaveBeenCalledWith(mockLocalNode, mockLocalNode, [
        'localDev',
        'componentDeps',
      ]);
      expect(isDeepEqual).not.toHaveBeenCalledWith(
        expect.anything(),
        autoGeneratedDeployedNode,
        expect.anything()
      );
    });

    it('should preserve non-auto-generated nodes in the comparison', async () => {
      const secondLocalNode: IntermediateRepresentationNodeLocalDev = {
        uid: 'component2',
        componentType: 'APPLICATION',
        localDev: {
          componentRoot: '/local/app',
          componentConfigPath: '/local/app/config.json',
          configUpdatedSinceLastUpload: false,
          removed: false,
          parsingErrors: [],
        },
        componentDeps: {},
        metaFilePath: 'app-component-hsmeta.json',
        config: { name: 'App Component' },
        files: [],
      };
      const localNodesWithTwo = {
        component1: mockLocalNode,
        component2: secondLocalNode,
      };

      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: localNodesWithTwo,
      });
      (isDeepEqual as Mock).mockReturnValue(true);

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        localNodesWithTwo
      );

      expect(result).toEqual(emptyChanged);
      expect(isDeepEqual).toHaveBeenCalledWith(mockLocalNode, mockLocalNode, [
        'localDev',
        'componentDeps',
      ]);
      expect(isDeepEqual).toHaveBeenCalledWith(
        secondLocalNode,
        secondLocalNode,
        ['localDev', 'componentDeps']
      );
    });
  });

  describe('error handling', () => {
    it('should return empty changed components and warn when download fails', async () => {
      (downloadProject as Mock).mockRejectedValue(new Error('Download Error'));

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toEqual(emptyChanged);
      expect(mockUiLogger.warn).toHaveBeenCalledOnce();
      expect(fs.remove).toHaveBeenCalledWith(mockTempDir);
    });

    it('should return empty changed components and warn when translation fails', async () => {
      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (translate as Mock).mockRejectedValue(new Error('Translation Error'));

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toEqual(emptyChanged);
      expect(mockUiLogger.warn).toHaveBeenCalledOnce();
      expect(fs.remove).toHaveBeenCalledWith(mockTempDir);
    });

    it('should default to "src" when hsproject.json has no srcDir field', async () => {
      (downloadProject as Mock).mockResolvedValue({ data: mockZippedProject });
      (extractZipArchive as Mock).mockResolvedValue(undefined);
      (fs.readJson as Mock).mockResolvedValue({ platformVersion: '1.0.0' });
      (translate as Mock).mockResolvedValue({
        intermediateNodesIndexedByUid: mockLocalProjectNodes,
      });
      (isDeepEqual as Mock).mockReturnValue(true);

      const result = await getLocallyChangedComponents(
        mockProjectConfig,
        mockAccountId,
        mockBuildId,
        mockLocalProjectNodes
      );

      expect(result).toEqual(emptyChanged);
      expect(translate).toHaveBeenCalledWith(
        expect.objectContaining({
          projectSourceDir: `${mockTempDir}/src`,
        }),
        expect.anything()
      );
    });
  });
});
