'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = function (argv) {
  var output = argv.output,
      source = argv.source;

  // Make sure source does not have a trailing separator

  if (source[source.length - 1] === _path2.default.sep) {
    source = source.substr(0, source.length - 1);
  }

  // Make sure output does not have a trailing separator
  if (output[output.length - 1] === _path2.default.sep) {
    output = output.substr(0, output.length - 1);
  }

  process.on('message', processActionFromMater.bind(null, source, output));
};

var _babelCore = require('babel-core');

var _fs = require('fs');

var _mkdirp = require('mkdirp');

var _mkdirp2 = _interopRequireDefault(_mkdirp);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _actions = require('./actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var TRANSFORM_OPTIONS = Object.freeze({
  presets: ['es2015', 'react']
});

/**
 * Copy file.
 * @param filePath - full path of file to copy
 * @param outputFilePath - path to copy file to
 * @returns resolves once file has been copied or rejects with error
 */
function copyFile(filePath, outputFilePath) {
  return new Promise(function (resolve, reject) {
    var readStream = (0, _fs.createReadStream)(filePath);
    var writeStream = (0, _fs.createWriteStream)(outputFilePath);

    readStream.on('error', function (err) {
      reject(err);
    });

    writeStream.on('error', function (err) {
      reject(err);
    }).on('close', function () {
      resolve();
    });

    readStream.pipe(writeStream);
  });
}

/**
 * Create output directory for file if it doesn't already exist.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path to source file
 * @returns resolves with output file path or rejects with error
 */
function createDirectoryForFile(source, output, filePath) {
  var relativeFilePath = _path2.default.relative(source, filePath);
  var relativeDirectoryPath = _path2.default.dirname(relativeFilePath);
  var outputDirectoryPath = _path2.default.join(output, relativeDirectoryPath);

  return new Promise(function (resolve, reject) {
    (0, _mkdirp2.default)(outputDirectoryPath, function (err) {
      if (err) {
        reject(new Error('Failed to create directory ' + outputDirectoryPath));
      }

      var fileName = _path2.default.basename(filePath);
      var outputFilePath = _path2.default.join(outputDirectoryPath, fileName);

      resolve(outputFilePath);
    });
  });
}

/**
 * Get contents of a file.
 * @param filePath - full path of file to get contents of
 * @returns resolves with file contents or rejects with error
 */
function getFileContents(filePath) {
  return new Promise(function (resolve, reject) {
    (0, _fs.readFile)(filePath, 'utf8', function (err, data) {
      if (err) {
        reject(new Error('Failed to get contents of file ' + filePath));
      }

      resolve(data);
    });
  });
}

/**
 * Process actions from master.
 * @param source - source directory
 * @param output - output directory
 * @param data - action from master
 */
function processActionFromMater(source, output, data) {
  if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== 'object') {
    throw new Error('Expected message from master to be an object but instead received type ' + (typeof data === 'undefined' ? 'undefined' : _typeof(data)));
  }

  if (data === null) {
    throw new Error('Expected message from master to be present but instead received null');
  }

  switch (data.type) {
    case _actions.REMOVE_FILE:
      removeOutputFile(source, output, data.filePath);
      break;

    case _actions.TRANSFORM_FILE:
      transformFile(source, output, data.filePath);
      break;

    default:
      throw new Error('Master sent message with unknown action type ' + data.type);
  }
}

/**
 * Remove file.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 */
function removeOutputFile(source, output, filePath) {
  var relativeFilePath = _path2.default.relative(source, filePath);
  var relativeDirectoryPath = _path2.default.dirname(relativeFilePath);
  var outputDirectoryPath = _path2.default.join(output, relativeDirectoryPath);
  var fileName = _path2.default.basename(filePath);
  var outputFilePath = _path2.default.join(outputDirectoryPath, fileName);

  (0, _fs.removeFile)(outputFilePath, function (err) {
    if (err) {
      throw err;
    }

    process.send({
      type: _actions.IDLE
    });
  });
}

/**
 * Transform file.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 */
function transformFile(source, output, filePath) {
  createDirectoryForFile(source, output, filePath).then(function (outputFilePath) {
    var extension = _path2.default.extname(filePath);

    switch (extension) {
      case '':
        // Ignoring empty directories
        return null;

      case '.js':
        return transformJavascriptFile(filePath, outputFilePath);

      default:
        return copyFile(filePath, outputFilePath);
    }
  }).then(function () {
    process.send({
      type: _actions.IDLE
    });
  }).catch(function (err) {
    throw err;
  });
}

/**
 * Transform file.
 * @param filePath - full path of file to transform
 * @param outputFilePath - path to write transformed file to
 * @returns resolves once file has been written or rejects with error
 */
function transformJavascriptFile(filePath, outputFilePath) {
  return getFileContents(filePath).then(function (contents) {
    var result = (0, _babelCore.transform)(contents, TRANSFORM_OPTIONS);
    return writeDataToFile(outputFilePath, result.code);
  });
}

/**
 * Write data to file.
 * @param data - data to write
 * @param filePath - path of file to write to
 * @returns resolves once file is written or rejects with an error
 */
function writeDataToFile(filePath, data) {
  return new Promise(function (resolve, reject) {
    (0, _fs.writeFile)(filePath, data, 'utf8', function (err) {
      if (err) {
        reject(new Error('Failed to write file ' + filePath));
      }

      resolve();
    });
  });
}

/**
 * Spin up worker process.
 * @param argv - command line arguments
 */