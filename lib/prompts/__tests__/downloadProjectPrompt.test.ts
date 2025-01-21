import { getAccountId } from '@hubspot/local-dev-lib/config';
import { fetchProjects } from '@hubspot/local-dev-lib/api/projects';
import { downloadProjectPrompt } from '../downloadProjectPrompt';

jest.mock('../promptUtils');
jest.mock('@hubspot/local-dev-lib/api/projects', () => ({
  fetchProjects: jest.fn().mockResolvedValue({
    data: { results: [] },
  }),
}));
jest.mock('@hubspot/local-dev-lib/config', () => ({
  getAccountId: jest.fn().mockImplementation(() => 123456789),
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
