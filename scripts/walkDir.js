const { resolve } = require('path');
const fs = require('fs-extra');

const ignoredFiles = ['package.json', 'package-lock.json'];
const ignoredDirs = ['node_modules', 'media', 'scripts'];

/*
 * Generator that recursively walks into a specified directory.
 * Yields the content of each file.
 */
function *walkDir(dirname) {
  // Read all files in specified directory and loop through them.
  for (let file of fs.readdirSync(dirname)) {
    const absPath = resolve('./', dirname, file);
    const stat = fs.statSync(absPath);

    if (stat.isDirectory()) {
      // Don't walk on ignored directories
      if (ignoredDirs.includes(file)) {
        continue;
      }

      yield *walkDir(absPath);
    }

    if (file.endsWith('.json') && !ignoredFiles.includes(file)) {
      // eslint-disable-next-line import/no-dynamic-require, global-require
      yield require(absPath);
    }
  }
};

module.exports = walkDir;
