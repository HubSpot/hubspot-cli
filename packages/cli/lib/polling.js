const { POLLING_DELAY, POLLING_STATUS } = require('./constants');

const poll = (callback, accountId, taskId) => {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      const pollResp = await callback(accountId, taskId);
      const { status } = pollResp;

      if (status === POLLING_STATUS.SUCCESS) {
        clearInterval(pollInterval);
        resolve(pollResp);
      } else if (
        status === POLLING_STATUS.ERROR ||
        status === POLLING_STATUS.FAILURE
      ) {
        clearInterval(pollInterval);
        reject(pollResp);
      }
    }, POLLING_DELAY);
  });
};

module.exports = {
  poll,
};
