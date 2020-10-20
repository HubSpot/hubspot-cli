const moment = require('moment');

const getFunctionArrays = resp => {
  return resp.objects.map(func => {
    const { route, method, created, updated, secretNames } = func;
    return [
      route,
      method,
      secretNames.join(', '),
      `${created} (${moment(created).format()})`,
      `${updated}(${moment(updated).format()})`,
    ];
  });
};

module.exports = {
  getFunctionArrays,
};
