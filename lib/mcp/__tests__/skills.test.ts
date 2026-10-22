import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import {
  MCP_SKILL_NAMES,
  SKILLS_SOURCE_DIR,
  installSkills,
} from '../skills.js';
import SpinniesManager from '../../ui/SpinniesManager.js';
import { logError } from '../../errorHandlers/index.js';
import { commands } from '../../../lang/en.js';

vi.mock('fs-extra');
vi.mock('os');
vi.mock('../../ui/SpinniesManager.js');
vi.mock('../../errorHandlers/index.js');

const mockedFs = vi.mocked(fs);
const mockedSpinniesManager = vi.mocked(SpinniesManager);
const mockedLogError = vi.mocked(logError);

const MARKER = '.installed-by-hubspot-cli';
const RM_OPTIONS = { recursive: true, force: true };
const claudeDir = path.join('/home/user', '.claude', 'skills');
const agentsDir = path.join('/home/user', '.agents', 'skills');

describe('lib/mcp/skills', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(os.homedir).mockReturnValue('/home/user');
  });

  describe('MCP_SKILLS', () => {
    it('lists every skill folder that ships with the MCP server', async () => {
      const actualFs =
        await vi.importActual<typeof import('fs-extra')>('fs-extra');
      const bundledSkillNames = actualFs
        .readdirSync(SKILLS_SOURCE_DIR, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name);

      expect([...MCP_SKILL_NAMES].sort()).toEqual(bundledSkillNames.sort());
      MCP_SKILL_NAMES.forEach(skillName => {
        expect(
          actualFs.existsSync(
            path.join(SKILLS_SOURCE_DIR, skillName, 'SKILL.md')
          )
        ).toBe(true);
      });
    });
  });

  describe('installSkills', () => {
    it('copies each selected skill into each target folder', () => {
      const result = installSkills(
        ['cursor', 'claude'],
        ['hubspot-new-app', 'hubspot-fix-build']
      );

      expect(result).toBe(true);
      expect(mockedFs.copySync).toHaveBeenCalledTimes(4);
      expect(mockedFs.copySync).toHaveBeenCalledWith(
        path.join(SKILLS_SOURCE_DIR, 'hubspot-new-app'),
        path.join(agentsDir, 'hubspot-new-app')
      );
      expect(mockedFs.copySync).toHaveBeenCalledWith(
        path.join(SKILLS_SOURCE_DIR, 'hubspot-fix-build'),
        path.join(claudeDir, 'hubspot-fix-build')
      );
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledTimes(1);
      expect(mockedSpinniesManager.succeed).toHaveBeenCalledWith('mcpSkills', {
        text: commands.mcp.setup.spinners.installedSkills(
          ['hubspot-new-app', 'hubspot-fix-build'],
          [claudeDir, agentsDir]
        ),
      });
    });

    it('installs once into the shared folder for every client except Claude Code', () => {
      installSkills(
        ['codex', 'cursor', 'vscode', 'devin', 'opencode'],
        ['hubspot-new-app']
      );

      expect(mockedFs.copySync).toHaveBeenCalledTimes(1);
      expect(mockedFs.copySync).toHaveBeenCalledWith(
        path.join(SKILLS_SOURCE_DIR, 'hubspot-new-app'),
        path.join(agentsDir, 'hubspot-new-app')
      );
    });

    it('marks each installed skill folder as owned by the CLI', () => {
      installSkills(['claude'], ['hubspot-new-app']);

      expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join(claudeDir, 'hubspot-new-app', MARKER),
        ''
      );
    });

    it('removes the old copy of a skill before it copies the new one', () => {
      installSkills(['claude'], ['hubspot-new-app']);

      expect(mockedFs.rmSync).toHaveBeenCalledTimes(1);
      expect(mockedFs.rmSync).toHaveBeenCalledWith(
        path.join(claudeDir, 'hubspot-new-app'),
        RM_OPTIONS
      );
      expect(mockedFs.copySync).toHaveBeenCalledTimes(1);
      expect(mockedFs.rmSync.mock.invocationCallOrder[0]).toBeLessThan(
        mockedFs.copySync.mock.invocationCallOrder[0]
      );
    });

    describe('when a target folder has skills from an earlier install', () => {
      const markedSkills = [
        'hubspot-new-app',
        'hubspot-fix-build',
        'hubspot-retired-skill',
      ];

      beforeEach(() => {
        mockedFs.readdirSync.mockImplementation(((dir: fs.PathLike) =>
          dir === claudeDir
            ? [...markedSkills, 'my-own-skill'].map(name => ({
                name,
                isDirectory: () => true,
              }))
            : []) as unknown as typeof fs.readdirSync);
        mockedFs.existsSync.mockImplementation(
          filePath =>
            filePath === claudeDir ||
            markedSkills.some(
              name => filePath === path.join(claudeDir, name, MARKER)
            )
        );
      });

      it('removes CLI-installed skills that the CLI no longer ships', () => {
        installSkills(['claude'], ['hubspot-new-app', 'hubspot-fix-build']);

        expect(mockedFs.rmSync).toHaveBeenCalledTimes(3);
        expect(mockedFs.rmSync).toHaveBeenCalledWith(
          path.join(claudeDir, 'hubspot-retired-skill'),
          RM_OPTIONS
        );
        expect(mockedFs.copySync).toHaveBeenCalledTimes(2);
      });

      it('removes CLI-installed skills that the user did not select', () => {
        installSkills(['claude'], ['hubspot-new-app']);

        expect(mockedFs.rmSync).toHaveBeenCalledTimes(3);
        expect(mockedFs.rmSync).toHaveBeenCalledWith(
          path.join(claudeDir, 'hubspot-fix-build'),
          RM_OPTIONS
        );
        expect(mockedFs.copySync).toHaveBeenCalledTimes(1);
      });

      it('keeps skills that the CLI did not install', () => {
        installSkills(['claude'], ['hubspot-new-app']);

        expect(mockedFs.rmSync).not.toHaveBeenCalledWith(
          path.join(claudeDir, 'my-own-skill'),
          RM_OPTIONS
        );
      });
    });

    it('ignores names that are not bundled skills', () => {
      installSkills(
        ['claude'],
        ['hubspot-new-app', '', '../outside', 'not-a-skill']
      );

      expect(mockedFs.rmSync).toHaveBeenCalledTimes(1);
      expect(mockedFs.rmSync).toHaveBeenCalledWith(
        path.join(claudeDir, 'hubspot-new-app'),
        RM_OPTIONS
      );
      expect(mockedFs.copySync).toHaveBeenCalledTimes(1);
    });

    it('does not treat a symlinked folder as a CLI-installed skill', () => {
      mockedFs.readdirSync.mockReturnValue([
        { name: 'linked-skill', isDirectory: () => false },
      ] as unknown as ReturnType<typeof fs.readdirSync>);
      mockedFs.existsSync.mockReturnValue(true);

      installSkills(['claude'], ['hubspot-new-app']);

      expect(mockedFs.rmSync).toHaveBeenCalledTimes(1);
      expect(mockedFs.rmSync).toHaveBeenCalledWith(
        path.join(claudeDir, 'hubspot-new-app'),
        RM_OPTIONS
      );
    });

    it('returns false and logs the error when a copy fails', () => {
      const error = new Error('Permission denied');
      mockedFs.copySync.mockImplementation(() => {
        throw error;
      });

      const result = installSkills(['claude'], ['hubspot-new-app']);

      expect(result).toBe(false);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledTimes(1);
      expect(mockedSpinniesManager.fail).toHaveBeenCalledWith('mcpSkills', {
        text: commands.mcp.setup.spinners.failedToInstallSkills,
      });
      expect(mockedSpinniesManager.succeed).not.toHaveBeenCalled();
      expect(mockedLogError).toHaveBeenCalledTimes(1);
      expect(mockedLogError).toHaveBeenCalledWith(error);
    });
  });
});
