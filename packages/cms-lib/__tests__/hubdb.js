const { downloadHubDbTable } = require('../hubdb');
const { getCwd } = require('../path');

jest.mock('../path');
jest.mock('../api/hubdb');

describe('cms-lib/api/hubdb', () => {
  it('downloads hubdb table', async () => {
    const portalId = 123;
    const tableId = 456;
    const destPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    getCwd.mockReturnValue(projectCwd);

    const { filePath } = await downloadHubDbTable(portalId, tableId, destPath);

    expect(filePath).toEqual(`${projectCwd}/${destPath}`);
  });
});
