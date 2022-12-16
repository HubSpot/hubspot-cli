const fs = require('fs');
const path = require('path');
const ejs = require('ejs');
const {Octokit} = require("@octokit/rest");

const {logger} = require('@hubspot/cli-lib/logger');
const os = require("os");
const fetch = require('node-fetch')


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

function parseGithubUrl(url) {
    // TODO: This regex doesn't work if the content is not in a sub directory
    const regex = /https:\/\/github.com\/(.*)\/(.*)\/tree\/(.*)\/(.*)/;
    const matches = url.match(regex);
    if (matches === null) {
        throw new Error('Invalid GitHub URL');
    }

    return {
        owner: matches[1],
        repo: matches[2],
        branch: matches[3],
        filePath: matches[4],
    }
}

const octokit = new Octokit({
    auth: "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",
})

async function downloadFileAsBuffer(url) {
    // Send a GET request to the GitHub API to retrieve the code from the URL
    // eslint-disable-next-line no-undef
    const response = await fetch(url);

    // Check if the request was successful
    if (response.ok) {
        // If the request was successful, return the code as a Buffer object
        return response.arrayBuffer();
    } else {
        // If the request was not successful, throw an error
        throw new Error(`Could not download code from ${url}: ${response.status} ${response.statusText}`);
    }
}

async function downloadBoilerplateComponent(owner, repo, path, branch) {
    const response = await octokit.repos.getContent({
        owner,
        repo,
        path,
        ref: branch
    });

    const files = response.data.map(async (fileInfo) => {
        if (fileInfo.type === "file") {
            return  {
                name: fileInfo.name,
                content: await downloadFileAsBuffer(fileInfo.download_url),// download it
                filePath: fileInfo.path,
                fileType: fileInfo.type
            }
        } else {
            return downloadBoilerplateComponent(owner, repo, fileInfo.path, branch);
        }
    });

    return Promise.all(files);
}

function cleanAndValidateFiles(generatorFileDir, files) {
    files.forEach((file) => {
        if (file instanceof Array) {
            cleanAndValidateFiles(generatorFileDir, file);
        } else {
            file.filePath = file.filePath.replace(generatorFileDir, '');
            if (file.filePath.startsWith('/')) {
                file.filePath = file.filePath.slice(1);
            }
        }
    });

    return files;
}

function downloadFilesToTmpDir(files, tmpDir) {
    files.forEach((file) => {
        if (file.fileType === 'file') {
            const filePath = path.join(tmpDir, file.filePath);
            fs.mkdirSync(path.dirname(filePath), { recursive: true });
            fs.writeFileSync(filePath, Buffer.from(file.content));
        } else {
            downloadFilesToTmpDir(file, tmpDir);
        }
    });
}

async function downloadGithubRepo(url) {
    const {owner, repo, branch, filePath} = parseGithubUrl(url);
    const files = await downloadBoilerplateComponent(owner, repo, filePath, branch).then((files) => {
        // Check if generator.json exist
        const generatorFile = files.find((file) => file.name === 'generator.json')
        if (!generatorFile) {
            throw new Error('No generator.json file found in the repo.')
        }

        const generatorFileDir = path.dirname(generatorFile.filePath);
        return cleanAndValidateFiles(generatorFileDir, files);
    });

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hs-project-generate-' + Date.now()));
    downloadFilesToTmpDir(files, tmpDir);
    logger.info(`Finished downloading files from ${url}`)
    return tmpDir;
}

function cleanUpTempDir(tmpdir) {
    fs.rmdirSync(tmpdir, {recursive: true})
}

module.exports = {
    readGeneratorFile,
    copyAndParseDir,
    downloadGithubRepo,
    cleanUpTempDir
}
