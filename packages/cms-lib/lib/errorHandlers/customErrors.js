const getErrorMessage = error => {
  const { category } = error;

  switch (category) {
    case 'MISSING_SCOPES':
      return 'Your personal CMS access key is missing required permissions for this action. Your account may not have these permissions or you may need to generate a new access key to add them. You can do so by running "hs auth personalaccesskey". If you believe this is in error, please contact your administrator.';
    default:
      return error.message;
  }
};

module.exports = {
  getErrorMessage,
};
