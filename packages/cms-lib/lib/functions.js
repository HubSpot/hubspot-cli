const moment = require('moment');
const util = require('util');

const { logger } = require('../logger');

const formatCompactOutput = func => {
  return `${func.method}\t/${func.route} (https://mtalley-101867970.hs-sitesqa.com/_hcms/api/${func.route})`;
};

const formatFullOutput = func => {
  return `/${
    func.route
  }\nURL: https://mtalley-101867970.hs-sitesqa.com/_hcms/api/${
    func.route
  }\nMethod: ${func.method}\nSecrets: ${util.inspect(func.secretNames, {
    colors: true,
    compact: true,
    depth: 'Infinity',
  })}\nCreated: ${func.created} (${moment(func.created).format()})\nUpdated: ${
    func.updated
  } (${moment(func.updated).format()})\n`;
};

const formatFunctionOutput = (func, options) => {
  if (options.compact) {
    return formatCompactOutput(func);
  }

  return formatFullOutput(func);
};

const processFunction = (func, options) => {
  try {
    return formatFunctionOutput(func, options);
  } catch (e) {
    logger.error(`Unable to process log ${JSON.stringify(func)}`);
  }
};

const processOutput = (resp, options) => {
  if (!resp || (resp.objects && !resp.objects.length)) {
    return 'No functions found.';
  } else if (resp.objects && resp.objects.length) {
    return resp.objects
      .map(func => {
        return processFunction(func, options);
      })
      .join('\n');
  }
  return processFunction(resp, options);
};

const outputFunctions = (resp, options) => {
  if (options.json) {
    return logger.log(resp.objects);
  }

  return logger.log(processOutput(resp, options));
};

module.exports = {
  outputFunctions,
};
