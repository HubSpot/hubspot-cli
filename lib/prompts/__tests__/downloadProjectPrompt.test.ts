import { getAccountId } from '@hubspot/local-dev-lib/config';
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
  getAccountId: vi.fn().mockImplementation(() => 123456789),
}));

describe('lib/prompts/downloadProjectPrompt', () => {
  it('should honor the account passed as an option', async () => {
    const account = 'Prod';
    await downloadProjectPrompt({ account });
    expect(getAccountId).toHaveBeenCalledTimes(1);
    expect(getAccountId).toHaveBeenCalledWith(account);
  });

  it('should fetch the projects for the correct accountId', async () => {
    const account = 'Prod';
    await downloadProjectPrompt({ account });
    expect(fetchProjects).toHaveBeenCalledTimes(1);
    expect(fetchProjects).toHaveBeenCalledWith(123456789);
  });
});
