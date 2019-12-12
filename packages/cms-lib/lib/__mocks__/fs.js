const fs = jest.genMockFromModule('fs');

let mockedReadFile = '';
let mockedExistsValue = false;

fs.__setReadFile = newValue => (mockedReadFile = newValue);
fs.__setExistsValue = newValue => (mockedExistsValue = newValue);

fs.readFileSync = () => mockedReadFile;
fs.existsSync = () => mockedExistsValue;
fs.writeFileSync = () => true;
fs.unlinkSync = () => true;

module.exports = fs;
