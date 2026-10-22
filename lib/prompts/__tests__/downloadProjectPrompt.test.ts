import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { downloadProjectPrompt } from '../downloadProjectPrompt.js';
import { promptUser } from '../promptUtils.js';

vi.mock('../promptUtils', () => ({
  promptUser: vi.fn().mockResolvedValue({ project: 'test-project' }),
}));
vi.mock('@hubspot/local-dev-lib/api/projects', () => ({
  fetchProjects: vi.fn().mockResolvedValue({
    data: { results: [] },
  }),
}));
vi.mock('@hubspot/local-dev-lib/config', () => ({
  getConfigAccountIfExists: vi
    .fn()
    .mockImplementation(() => ({ accountId: 123456789 })),
  globalConfigFileExists: vi.fn().mockReturnValue(true),
}));

const mockedPromptUser = vi.mocked(promptUser);

function getProjectPromptMessage(): unknown {
  const [config] = mockedPromptUser.mock.calls[0];
  const [question] = Array.isArray(config) ? config : [config];
  return typeof question.message === 'function'
    ? question.message({})
    : question.message;
}

describe('lib/prompts/downloadProjectPrompt', () => {
  it('should honor the account passed as an option', async () => {
    const account = 'Prod';
    await downloadProjectPrompt({ account });
    expect(getConfigAccountIfExists).toHaveBeenCalledTimes(1);
    expect(getConfigAccountIfExists).toHaveBeenCalledWith(account);
  });

  it('should fetch the projects for the correct accountId', async () => {
    const account = 'Prod';
    await downloadProjectPrompt({ account });
    expect(fetchProjects).toHaveBeenCalledTimes(1);
    expect(fetchProjects).toHaveBeenCalledWith(123456789);
  });

  it('should prefix the project selection prompt with the --project flag', async () => {
    await downloadProjectPrompt({ account: 'Prod' });

    expect(getProjectPromptMessage()).toEqual(
      expect.stringMatching(/^\[--project\] Select a project/)
    );
  });

  it('should prefix the project not found prompt with the --project flag', async () => {
    await downloadProjectPrompt({ account: 'Prod', project: 'missing' });

    expect(getProjectPromptMessage()).toEqual(
      expect.stringMatching(
        /^\[--project\] Your project missing could not be found/
      )
    );
  });

  it('should describe the account in the project not found prompt', async () => {
    await downloadProjectPrompt({ account: 'Prod', project: 'missing' });

    expect(getProjectPromptMessage()).toEqual(
      expect.stringContaining('123456789')
    );
  });
});
