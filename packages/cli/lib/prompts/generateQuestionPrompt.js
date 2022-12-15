const { promptUser } = require('./promptUtils');

const generateQuestionPrompt = (choices) => {
    return promptUser(
        choices.map(({text, tagValue}) => ({
            name: tagValue,
            message: text,
        }))
    )
};

module.exports = {
    generateQuestionPrompt,
};
