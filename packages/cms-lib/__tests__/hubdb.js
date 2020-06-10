const { downloadHubDbTable } = require('../hubdb');

jest.mock('../api/hubdb');

describe('cms-lib/api/hubdb', () => {
  it('downloads hubdb table', async () => {
    const portalId = 123;
    const tableId = 456;
    const destPath = 'tmp.json';

    const { filePath } = await downloadHubDbTable(portalId, tableId, destPath);

    expect(filePath).toEqual(destPath);
  });
});
