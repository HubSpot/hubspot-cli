import { projectNamePrompt } from '../projectNamePrompt.js';
import { promptUser } from '../promptUtils.js';
import { ensureProjectExists } from '../../projects/ensureProjectExists.js';
import { lib } from '../../../lang/en.js';

vi.mock('@hubspot/local-dev-lib/config');
vi.mock('../promptUtils');
vi.mock('../../projects/ensureProjectExists');

const mockedPromptUser = vi.mocked(promptUser);
const mockedEnsureProjectExists = vi.mocked(ensureProjectExists);

const ACCOUNT_ID = 123;

type ValidateFn = (value?: unknown) => Promise<unknown>;

function getPromptConfig(): { when: boolean; validate: ValidateFn } {
  const [config] = mockedPromptUser.mock.calls[0];
  return config as unknown as { when: boolean; validate: ValidateFn };
}

describe('lib/prompts/projectNamePrompt', () => {
  describe('projectNamePrompt()', () => {
    beforeEach(() => {
      mockedPromptUser.mockResolvedValue({ projectName: 'prompted-project' });
      mockedEnsureProjectExists.mockResolvedValue({
        projectExists: true,
        project: undefined,
      } as unknown as Awaited<ReturnType<typeof ensureProjectExists>>);
    });

    it('should return the prompted project name', async () => {
      const result = await projectNamePrompt(ACCOUNT_ID);

      expect(result).toEqual({ projectName: 'prompted-project' });
    });

    it('should prompt for the project name when no project option is provided', async () => {
      await projectNamePrompt(ACCOUNT_ID);

      expect(mockedPromptUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'projectName',
          message: lib.prompts.projectNamePrompt.enterName,
          when: true,
        })
      );
    });

    it('should skip the prompt when the project option is provided', async () => {
      await projectNamePrompt(ACCOUNT_ID, { project: 'given-project' });

      expect(getPromptConfig().when).toBe(false);
    });

    it('should fall back to the project option when the prompt returns no project name', async () => {
      mockedPromptUser.mockResolvedValue({});

      const result = await projectNamePrompt(ACCOUNT_ID, {
        project: 'given-project',
      });

      expect(result).toEqual({ projectName: 'given-project' });
    });

    it('should not set a project name when the prompt returns none and no option is provided', async () => {
      mockedPromptUser.mockResolvedValue({});

      const result = await projectNamePrompt(ACCOUNT_ID);

      expect(result).toEqual({});
    });

    describe('validate', () => {
      beforeEach(async () => {
        await projectNamePrompt(ACCOUNT_ID);
      });

      it('should return the invalid name error when the value is not a string', async () => {
        await expect(getPromptConfig().validate(undefined)).resolves.toBe(
          lib.prompts.projectNamePrompt.errors.invalidName
        );
        expect(mockedEnsureProjectExists).not.toHaveBeenCalled();
      });

      it('should return the invalid name error when the value is empty', async () => {
        await expect(getPromptConfig().validate('')).resolves.toBe(
          lib.prompts.projectNamePrompt.errors.invalidName
        );
      });

      it('should return the project does not exist error when the project is not found', async () => {
        mockedEnsureProjectExists.mockResolvedValue({
          projectExists: false,
        } as unknown as Awaited<ReturnType<typeof ensureProjectExists>>);

        await expect(getPromptConfig().validate('missing')).resolves.toBe(
          lib.prompts.projectNamePrompt.errors.projectDoesNotExist(
            'missing',
            ACCOUNT_ID
          )
        );
      });

      it('should check for the project without creating it or logging', async () => {
        await getPromptConfig().validate('existing');

        expect(mockedEnsureProjectExists).toHaveBeenCalledWith(
          ACCOUNT_ID,
          'existing',
          { allowCreate: false, noLogs: true }
        );
      });

      it('should return true when the project exists', async () => {
        await expect(getPromptConfig().validate('existing')).resolves.toBe(
          true
        );
      });
    });
  });
});
