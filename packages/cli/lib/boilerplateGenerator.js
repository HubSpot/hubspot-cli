const fs = require('fs');
const path = require('path');
const ejs = require('ejs');

const {logger} = require('@hubspot/cli-lib/logger');
const {generateQuestionPrompt} = require("./prompts/generateQuestionPrompt");


const copyDir = (source, dest) => {
    // check if source directory exists
    if (!fs.existsSync(source)) {
        throw new Error(`${source} does not exist`);
    }
    // check if destination directory exists
    if (fs.existsSync(dest)) {
        // if it does, remove it
        fs.rmSync(dest, {recursive: true});
    }
    // create the destination
    fs.mkdirSync(dest);

    // get a list of files from the source directory
    const files = fs.readdirSync(source);
    // loop through each file
    files.forEach(file => {
        // get the stats for the file
        const stats = fs.statSync(path.join(source, file));
        // check if it is a directory
        if (stats.isDirectory()) {
            // if it is, recursively call the function again
            copyDir(path.join(source, file), path.join(dest, file));
        } else {
            // if not, read the file contents
            const data = fs.readFileSync(path.join(source, file))
            fs.writeFileSync(path.join(dest, file), data);
            logger.log(`File ${file} copied to ${dest}`);
        }
    });
};

function removeEjsFiles(pathToDir) {
    const files = fs.readdirSync(pathToDir);

    files.forEach(file => {
        const filePath = path.join(pathToDir, file);

        if (fs.statSync(filePath).isDirectory()) {
            removeEjsFiles(filePath);
        } else if (file.endsWith('.ejs')) {
            fs.unlinkSync(filePath);
        }
    });
}

// parse the .ejs files with user-provided values
function parseTemplateFiles(dir, values) {
    const files = fs.readdirSync(dir);
    files.forEach(function (file) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            if (file.endsWith('.ejs')) {
                const data = fs.readFileSync(filePath);
                const renderedFile = ejs.render(data.toString(), values);

                fs.writeFileSync(filePath.slice(0, -4), renderedFile);
                logger.log(`Template ${file} parsed`);
            }
        } else {
            parseTemplateFiles(filePath, values);
        }
    });
}

const rollBack = (dest) => {
    logger.log(`Removing ${dest}`);
    fs.rmSync(dest, {recursive: true});
}

function readGeneratorFile(directoryPath) {
    const generatorFilePath = path.join(directoryPath, 'generator.json');
    let generatorFileContents;

    try {
        generatorFileContents = fs.readFileSync(generatorFilePath, 'utf8');
    } catch (err) {
        throw new Error('No generator.json file found in ' + directoryPath);
    }
    return JSON.parse(generatorFileContents);
}

function copyAndParseDir(src, dest, componentRoot, values) {
    const srcPath = path.join(src, componentRoot);
    try {
        logger.info(`Copying ${srcPath} to ${dest}`);
        copyDir(srcPath, dest);
        logger.info(`Parsing files in ${dest}`);
        parseTemplateFiles(dest, values);
        logger.info(`Removing .ejs files in ${dest}`);
        removeEjsFiles(dest);
        logger.info(`Finished copying and parsing ${srcPath} to ${dest}`);
    } catch (err) {
        rollBack(dest);
        throw err;
    }
}

module.exports = {
    readGeneratorFile,
    copyAndParseDir
}
