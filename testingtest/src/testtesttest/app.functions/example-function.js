exports.main = async (context = {}) => {
  const { text } = context.parameters;

  const response = `This is coming from a serverless function! You entered: ${text}`;

  return response;
};
