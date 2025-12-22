import { getConfigAccountIfExists } from '@hubspot/local-dev-lib/config';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { downloadProjectPrompt } from '../downloadProjectPrompt.js';

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
});
