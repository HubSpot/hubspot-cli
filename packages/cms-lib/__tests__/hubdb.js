const fs = require('fs-extra');
const { downloadHubDbTable, createHubDbTable } = require('../hubdb');
const hubdb = require('../api/hubdb');
const { getCwd } = require('../path');
const hubdbJson = require('./fixtures/hubdb/hubdbTableData');

jest.mock('../path');
jest.mock('../api/hubdb');

describe('cms-lib/hubdb', () => {
  it('downloads hubdb table', async () => {
    const portalId = 123;
    const tableId = 456;
    const destPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    getCwd.mockReturnValue(projectCwd);
    hubdb.fetchRows.mockReturnValue({
      total: 3,
      objects: [
        { name: 'My Event', values: { 1: 'a', 2: 'b', 3: 'c' } },
        { name: 'My Better Event', values: { 1: 'a', 2: 'b', 3: 'c' } },
        { name: 'My Best Event', values: { 1: 'a', 2: 'b', 3: 'c' } },
      ],
    });
    hubdb.fetchTable.mockReturnValue({
      name: 'events-test',
      allowChildTables: false,
      allowPublicApiAccess: false,
      columns: [{ id: 1 }, { id: 2 }, { id: 3 }],
    });

    const { filePath } = await downloadHubDbTable(portalId, tableId, destPath);

    describe('transforms column names to ids', () => {
      expect(fs.outputFile).toHaveBeenCalledWith(
        `${projectCwd}/${destPath}`,
        expect.stringContaining('"name": "My Event",')
      );
    });

    describe('provides data with correct name', () => {
      expect(fs.outputFile).toHaveBeenCalledWith(
        `${projectCwd}/${destPath}`,
        expect.stringContaining('events-test')
      );
    });

    describe('returns destination file path', () => {
      expect(filePath).toEqual(`${projectCwd}/${destPath}`);
    });
  });

  it('uploads hubdb table', async () => {
    const portalId = 123;
    const srcPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    fs.statSync.mockReturnValue({ isFile: () => true });
    fs.readJsonSync.mockReturnValue(hubdbJson);

    hubdb.createTable.mockReturnValue({
      columns: [1, 2, 3],
      id: 2639452,
    });

    hubdb.createRows.mockReturnValue([
      {
        rows: [4, 5, 6],
      },
    ]);

    const table = await createHubDbTable(portalId, `${projectCwd}/${srcPath}`);

    expect(table.rowCount).toEqual(3);
    expect(table.tableId).toEqual(2639452);
    expect(hubdb.publishTable).toBeCalled();
  });
});
