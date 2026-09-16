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

vi.mock('../uieLinting.js', async importOriginal => {
  const actual = await importOriginal<typeof import('../uieLinting.js')>();
  return {
    isUieComponentDirectory: actual.isUieComponentDirectory,
    areAllLintPackagesInstalled: lintingMocks.areAllLintPackagesInstalled,
    hasEslintConfig: lintingMocks.hasEslintConfig,
    isHubSpotEslintConfigActive: lintingMocks.isHubSpotEslintConfigActive,
  };
});

const projectDir = path.resolve('/project');
const srcDir = path.join(projectDir, 'src');
const appDir = path.join(srcDir, 'app');

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

  it('uses UIE component parsedPackageJsons dirs when isLegacyPlatform is false', async () => {
    const pkgDir = path.join(appDir, 'cards');
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

  it('checks every UIE component directory when isLegacyPlatform is false', async () => {
    const uieDirs = [
      path.join(appDir, 'cards', 'example-card'),
      path.join(appDir, 'settings'),
      path.join(appDir, 'pages', 'example-page'),
      path.join(appDir, 'actions'),
    ];

    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: uieDirs.map(dir => ({ dir }) as never),
      isLegacyPlatform: false,
    });

    for (const dir of uieDirs) {
      expect(lintingMocks.areAllLintPackagesInstalled).toHaveBeenCalledWith(
        dir
      );
    }
  });

  it('ignores non-UIE package.json locations when isLegacyPlatform is false', async () => {
    lintingMocks.areAllLintPackagesInstalled.mockReturnValue(false);
    const themeDir = path.join(srcDir, 'my-theme');
    const functionsDir = path.join(appDir, 'functions', 'my-function');

    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [
        { dir: themeDir } as never,
        { dir: functionsDir } as never,
        { dir: srcDir } as never,
        { dir: projectDir } as never,
      ],
      isLegacyPlatform: false,
    });

    expect(lintingMocks.areAllLintPackagesInstalled).not.toHaveBeenCalled();
    expect(uiLogger.warn).not.toHaveBeenCalled();
  });

  it('does not warn for a theme-only project with no UIE components', async () => {
    lintingMocks.areAllLintPackagesInstalled.mockReturnValue(false);

    await validateLintConfigOnUpload({
      srcDir,
      projectDir,
      parsedPackageJsons: [],
      isLegacyPlatform: false,
    });

    expect(lintingMocks.areAllLintPackagesInstalled).not.toHaveBeenCalled();
    expect(uiLogger.warn).not.toHaveBeenCalled();
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
