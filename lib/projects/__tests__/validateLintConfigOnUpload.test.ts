import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import { validateLintConfigOnUpload } from '../validateLintConfigOnUpload.js';
import { uiLogger } from '../../ui/logger.js';
import { lib } from '../../../lang/en.js';

const lintingMocks = vi.hoisted(() => ({
  areAllLintPackagesInstalled: vi.fn(),
  hasEslintConfig: vi.fn(),
  isHubSpotEslintConfigActive: vi.fn(),
}));

vi.mock('../uieLinting.js', () => ({
  areAllLintPackagesInstalled: lintingMocks.areAllLintPackagesInstalled,
  hasEslintConfig: lintingMocks.hasEslintConfig,
  isHubSpotEslintConfigActive: lintingMocks.isHubSpotEslintConfigActive,
}));

const projectDir = '/project';
const srcDir = '/project/src';

describe('validateLintConfigOnUpload', () => {
  beforeEach(() => {
    lintingMocks.areAllLintPackagesInstalled.mockReturnValue(true);
    lintingMocks.hasEslintConfig.mockReturnValue(true);
    lintingMocks.isHubSpotEslintConfigActive.mockResolvedValue(true);
  });

  it('uses srcDir as the single root when isLegacyPlatform is true', async () => {
    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [],
      isLegacyPlatform: true,
    });

    expect(lintingMocks.areAllLintPackagesInstalled).toHaveBeenCalledWith(
      srcDir
    );
  });

  it('uses parsedPackageJsons dirs when isLegacyPlatform is false', async () => {
    const pkgDir = '/project/src/app/cards';
    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [{ dir: pkgDir } as never],
      isLegacyPlatform: false,
    });

    expect(lintingMocks.areAllLintPackagesInstalled).toHaveBeenCalledWith(
      pkgDir
    );
    expect(lintingMocks.areAllLintPackagesInstalled).not.toHaveBeenCalledWith(
      srcDir
    );
  });

  it('falls back to srcDir when isLegacyPlatform is false and parsedPackageJsons is empty', async () => {
    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [],
      isLegacyPlatform: false,
    });

    expect(lintingMocks.areAllLintPackagesInstalled).toHaveBeenCalledWith(
      srcDir
    );
  });

  it('warns lintPackagesNotConfigured and skips remaining checks when packages not installed', async () => {
    lintingMocks.areAllLintPackagesInstalled.mockReturnValue(false);

    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [],
      isLegacyPlatform: true,
    });

    const relativeRoot = path.relative(projectDir, srcDir);
    expect(uiLogger.warn).toHaveBeenCalledWith(
      lib.projectUpload.handleProjectUpload.lintPackagesNotConfigured(
        relativeRoot
      )
    );
    expect(lintingMocks.isHubSpotEslintConfigActive).not.toHaveBeenCalled();
  });

  it('warns lintConfigNotFound and skips remaining checks when packages ok but config missing', async () => {
    lintingMocks.hasEslintConfig.mockReturnValue(false);

    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [],
      isLegacyPlatform: true,
    });

    const relativeRoot = path.relative(projectDir, srcDir);
    expect(uiLogger.warn).toHaveBeenCalledWith(
      lib.projectUpload.handleProjectUpload.lintConfigNotFound(relativeRoot)
    );
    expect(lintingMocks.isHubSpotEslintConfigActive).not.toHaveBeenCalled();
  });

  it('warns lintHubSpotRulesNotActive when HubSpot rules not found in resolved config', async () => {
    lintingMocks.isHubSpotEslintConfigActive.mockResolvedValue(false);

    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [],
      isLegacyPlatform: true,
    });

    const relativeRoot = path.relative(projectDir, srcDir);
    expect(uiLogger.warn).toHaveBeenCalledWith(
      lib.projectUpload.handleProjectUpload.lintHubSpotRulesNotActive(
        relativeRoot
      )
    );
  });

  it('does not warn when all checks pass', async () => {
    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [],
      isLegacyPlatform: true,
    });

    expect(uiLogger.warn).not.toHaveBeenCalled();
  });
});
