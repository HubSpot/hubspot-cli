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
        { name: 'My Event', values: { 1: 'a', 2: 'b' } },
        { name: 'My Better Event', values: { 1: 'c', 2: 'd' } },
        { name: 'My Best Event', values: { 1: 'e', 2: 'f' } },
      ],
    });
    hubdb.fetchTable.mockReturnValue({
      name: 'cool-table-name',
      allowChildTables: false,
      allowPublicApiAccess: false,
      columns: [
        {
          name: 'First Col',
          id: 1,
        },
        {
          name: 'Second Col',
          id: 2,
        },
      ],
    });

    const { filePath } = await downloadHubDbTable(portalId, tableId, destPath);
    const fileOutput = JSON.parse(fs.outputFile.mock.results[0].value);

    describe('outputs correct rows', () => {
      expect(fileOutput.rows.length).toBe(3);
      expect(fileOutput.rows[1].name).toBe('My Better Event');
    });

    describe('tranforms column ids to names', () => {
      expect(fileOutput.rows[0].values['Second Col']).toBe('b');
    });

    describe('provides data with correct name', () => {
      expect(fileOutput.name).toBe('cool-table-name');
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
