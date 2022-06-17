const fs = require('fs');
const path = require('path');

const fieldToJson = field => {
  if (typeof field['toJSON'] === 'function') {
    return field.toJSON();
  }
  return field;
};

const loadJson = file => {
  // We would do validation etc. here, but for now just load the file
  let json = JSON.parse(fs.readFileSync(path.resolve(file)));
  return json;
};

const loadPartial = (file, partial) => {
  let json = {};
  try {
    json = JSON.parse(fs.readFileSync(file));
  } catch (e) {
    console.log(`Partial ${partial} not found!`, partial, e);
  }
  if (partial in json) {
    return json[partial];
  } else {
    console.log(`Partial ${partial} not found!`, partial);
  }
  return {};
};

const fieldsArrayToJson = fields => {
  //Transform fields array to JSON
  fields = fields.flat(Infinity).map(field => fieldToJson(field));

  return JSON.stringify(fields);
};

exports.fieldsArrayToJson = fieldsArrayToJson;
exports.loadJson = loadJson;
exports.loadPartial = loadPartial;
