const hubdb = jest.genMockFromModule('../hubdb');

const hubdDbTableRequestData = {
  id: 456,
  name: 'events-test',
  portalId: 123,
  createdAt: 1589455214898,
  publishedAt: 1591712281423,
  updatedAt: 1589455214933,
  label: 'Events',
  columns: [
    {
      name: 'name',
      label: 'Name',
      id: 1,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'TEXT',
    },
    {
      name: 'start',
      label: 'Start',
      id: 2,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'DATETIME',
    },
    {
      name: 'end',
      label: 'End',
      id: 3,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'DATETIME',
    },
    {
      name: 'location',
      label: 'Location',
      id: 4,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'LOCATION',
    },
    {
      name: 'location_address',
      label: 'Location Address',
      id: 5,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'TEXT',
    },
    {
      name: 'event_description',
      label: 'Event Description',
      id: 6,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'RICHTEXT',
    },
    {
      name: 'feature_image',
      label: 'Feature Image',
      id: 7,
      deleted: false,
      width: 206,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'IMAGE',
    },
    {
      name: 'event_capacity',
      label: 'Event Capacity',
      id: 8,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'NUMBER',
    },
    {
      name: 'registered_attendee_count',
      label: 'Registered Attendee Count',
      id: 9,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'NUMBER',
    },
    {
      name: 'form_guid',
      label: 'Event Form',
      id: 10,
      deleted: false,
      foreignIdsById: {},
      foreignIdsByName: {},
      type: 'TEXT',
    },
  ],
  deleted: false,
  cosObjectType: 'HUBDB_TABLE',
  updated: 1589455214933,
  cdnPurgeEmbargoTime: null,
  rowCount: 3,
  useForPages: true,
  allowChildTables: false,
  enableChildTablePages: false,
  crmObjectTypeId: 0,
  dynamicMetaTags: {},
  columnCount: 10,
  allowPublicApiAccess: true,
};

const hubDbRowRequest = {
  objects: [
    {
      id: 28401989683,
      createdAt: 1586973421702,
      path: 'my-event',
      name: 'Event Page Title',
      values: {
        '1': 'My Event',
        '2': 1609538400000,
        '3': 1609549200000,
        '4': {
          lat: 42.369724,
          long: -71.07791,
          type: 'location',
        },
        '5': '25 First Street, Cambridge MA',
        '6':
          '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum  faucibus elit nec velit tempor, sit amet consequat magna efficitur.  Donec aliquam urna a tortor pretium, ut tincidunt metus fringilla. Sed  maximus molestie tristique.</p>',
        '7': {
          url:
            'https://designers.hubspot.com/hubfs/event-registration/grayscale-mountain.png',
          width: 1000,
          height: 745,
          type: 'image',
        },
        '8': 40,
        '9': 0,
        '10': '000-000-000',
      },
      isSoftEditable: false,
      childTableId: 0,
    },
    {
      id: 28401989684,
      createdAt: 1586973421710,
      path: 'my-event-2',
      name: 'Event Page Title',
      values: {
        '1': 'My Event',
        '2': 1612216800000,
        '3': 1612227600000,
        '4': {
          lat: 42.369724,
          long: -71.07791,
          type: 'location',
        },
        '5': '25 First Street, Cambridge MA',
        '6':
          '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum  faucibus elit nec velit tempor, sit amet consequat magna efficitur.  Donec aliquam urna a tortor pretium, ut tincidunt metus fringilla. Sed  maximus molestie tristique.</p>',
        '7': {
          url:
            'https://designers.hubspot.com/hubfs/event-registration/grayscale-mountain.png',
          width: 1000,
          height: 745,
          type: 'image',
        },
        '8': 40,
        '9': 0,
        '10': '000-000-000',
      },
      isSoftEditable: false,
      childTableId: 0,
    },
    {
      id: 28401989685,
      createdAt: 1586973421718,
      path: 'my-event-3',
      name: 'Event Page Title',
      values: {
        '1': 'My Event',
        '2': 1617310800000,
        '3': 1617319800000,
        '4': {
          lat: 42.369724,
          long: -71.07791,
          type: 'location',
        },
        '5': '25 First Street, Cambridge MA',
        '6':
          '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum  faucibus elit nec velit tempor, sit amet consequat magna efficitur.  Donec aliquam urna a tortor pretium, ut tincidunt metus fringilla. Sed  maximus molestie tristique.</p>',
        '7': {
          url:
            'https://designers.hubspot.com/hubfs/event-registration/grayscale-mountain.png',
          width: 1000,
          height: 745,
          type: 'image',
        },
        '8': 40,
        '9': 0,
        '10': '000-000-000',
      },
      isSoftEditable: false,
      childTableId: 0,
    },
  ],
  total: 3,
  limit: 1000,
  offset: 0,
  message: null,
  totalCount: 3,
};

hubdb.fetchTable = jest.fn(async (portalId, tableId) => {
  return new Promise((resolve, reject) => {
    const table = hubdDbTableRequestData;
    process.nextTick(() =>
      table.id === tableId
        ? resolve(table)
        : reject({
            error: 'Table with ' + tableId + ' not found.',
          })
    );
  });
});

hubdb.fetchRows = jest.fn(async (portalId, tableId) => {
  return new Promise((resolve, reject) => {
    const rows = hubDbRowRequest;
    process.nextTick(() =>
      rows.total
        ? resolve(rows)
        : reject({
            error: 'Error fetching rows for ' + tableId,
          })
    );
  });
});

hubdb.createTable = jest.fn(() => {
  return { columns: [], id: 999 };
});

hubdb.createRows = jest.fn((...data) => {
  console.log(...data);
});

module.exports = hubdb;
