"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = _default;

var _babelCore = require("babel-core");

var _fs = require("fs");

var _mkdirp = _interopRequireDefault(require("mkdirp"));

var _path = _interopRequireDefault(require("path"));

var _actions = require("./actions");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* global ErrnoError */
function send(action) {
  if (process.send) {
    process.send(action);
  } else {
    throw new Error('process.send is not defined');
  }
}
/**
 * Copy file.
 * @param filePath - full path of file to copy
 * @param outputFilePath - path to copy file to
 * @returns resolves once file has been copied or rejects with error
 */


function copyFile(filePath, outputFilePath) {
  return new Promise(function (resolve, reject) {
    (0, _fs.stat)(filePath, function (err, stats) {
      var writeStreamOptions = {};

      if (!err) {
        writeStreamOptions.mode = stats.mode;
      }

      var readStream = (0, _fs.createReadStream)(filePath);
      var writeStream = (0, _fs.createWriteStream)(outputFilePath, writeStreamOptions);
      readStream.on('error', function (err) {
        reject(err);
      });
      writeStream.on('error', function (err) {
        reject(err);
      }).on('finish', function () {
        resolve();
      });
      readStream.pipe(writeStream);
    });
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
  var relativeFilePath = _path.default.relative(source, filePath);

  var relativeDirectoryPath = _path.default.dirname(relativeFilePath);

  var outputDirectoryPath = _path.default.join(output, relativeDirectoryPath);

  return new Promise(function (resolve, reject) {
    (0, _mkdirp.default)(outputDirectoryPath, function (err) {
      if (err) {
        throw new Error(`Failed to create directory ${outputDirectoryPath}`);
      }

      var fileName = _path.default.basename(filePath);

      var outputFilePath = _path.default.join(outputDirectoryPath, fileName);

      resolve(outputFilePath);
    });
  });
}
/**
 * Log error and inform master worker is now idle again.
 * @param message - error message
 */


function error(message) {
  console.error(message);
  send({
    erred: true,
    type: _actions.IDLE
  });
}
/**
 * Get Babel configuration for transforming Javascript files
 * @param target - Node target
 * @returns Babel configuration
 */


function getBabelConfig(target, callback) // eslint-disable-line flowtype/no-weak-types
{
  var cwd = process.cwd();
  (0, _fs.readdir)(cwd, function (err, files) {
    if (!err) {
      var configFile = files.find(function (fileName) {
        return /^\.babelrc(\.[a-zA-Z]+)?$/.test(fileName);
      });

      if (configFile) {
        var filePath = _path.default.join(cwd, configFile);

        switch (_path.default.extname(configFile)) {
          case '.js':
            // $FlowFixMe - Flow doesn't like dynamic require statements
            callback(require(filePath));
            return;

          case '.json':
            (0, _fs.readFile)(filePath, 'utf8', function (err2, data) {
              callback(JSON.parse(data));
            });
            return;
        }
      }
    } // eslint-disable-next-line standard/no-callback-literal


    callback({
      presets: [['@babel/env', {
        targets: {
          node: target
        }
      }], '@babel/flow', '@babel/react']
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
        reject(new Error(`Failed to get contents of file ${filePath}`));
      }

      resolve(data);
    });
  });
}
/**
 * Process actions from master.
 * @param source - source directory
 * @param output - output directory
 * @param verbose - whether or not to have verbose logging
 * @param babelConfig - Babel config
 * @param data - action from master
 */


function processActionFromMater(source, output, verbose, babelConfig, // eslint-disable-line flowtype/no-weak-types
data) {
  if (typeof data !== 'object') {
    return error(`Expected message from master to be an object but instead received type ${typeof data}`);
  }

  if (data === null) {
    return error('Expected message from master to be present but instead received null');
  }

  switch (data.type) {
    case _actions.REMOVE_FILE:
      return removeOutputFile(source, output, data.filePath, verbose);

    case _actions.TRANSFORM_FILE:
      return transformFile(source, output, data.filePath, verbose, babelConfig);

    default:
      return error(`Master sent message with unknown action type ${data.type}`);
  }
}
/**
 * Remove file.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 * @param verbose - whether or not to have verbose logging
 */


function removeOutputFile(source, output, filePath, verbose) {
  var relativeFilePath = _path.default.relative(source, filePath);

  var relativeDirectoryPath = _path.default.dirname(relativeFilePath);

  var outputDirectoryPath = _path.default.join(output, relativeDirectoryPath);

  var fileName = _path.default.basename(filePath);

  var outputFilePath = _path.default.join(outputDirectoryPath, fileName);

  (0, _fs.unlink)(outputFilePath, function (err) {
    if (err) {
      console.error(`Failed to remove file ${outputFilePath}`);

      if (verbose) {
        console.error(err);
      }
    }

    send({
      erred: !!err,
      type: _actions.IDLE
    });
  });
}
/**
 * Transform file.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 * @param verbose - whether or not to have verbose logging
 * @param babelConfig - Babel configuration
 */


function transformFile(source, output, filePath, verbose, babelConfig) // eslint-disable-line flowtype/no-weak-types
{
  createDirectoryForFile(source, output, filePath).then(function (outputFilePath) {
    var extension = _path.default.extname(filePath);

    switch (extension) {
      case '':
        // Ignoring empty directories
        return null;

      case '.js':
        return transformJavascriptFile(filePath, outputFilePath, babelConfig);

      default:
        return copyFile(filePath, outputFilePath);
    }
  }).then(function () {
    return false;
  }).catch(function (err) {
    console.error(`Failed to process file ${filePath}`);

    if (verbose) {
      console.error(err);
    }

    return true;
  }).then(function (erred) {
    send({
      erred,
      type: _actions.IDLE
    });
  });
}
/**
 * Transform file.
 * @param filePath - full path of file to transform
 * @param outputFilePath - path to write transformed file to
 * @param babelConfig - Babel configuration
 * @returns resolves once file has been written or rejects with error
 */


function transformJavascriptFile(filePath, outputFilePath, babelConfig) {
  return getFileContents(filePath).then(function (contents) {
    return new Promise(function (resolve, reject) {
      (0, _fs.stat)(filePath, function (err1, stats) {
        var mode = err1 ? null : stats.mode;
        var result = (0, _babelCore.transform)(contents, babelConfig);
        writeDataToFile(outputFilePath, result.code, mode).then(function () {
          resolve();
        }).catch(function (err2) {
          reject(err2);
        });
      });
    });
  });
}
/**
 * Write data to file.
 * @param data - data to write
 * @param filePath - path of file to write to
 * @param mode - permission and sticky bits
 * @returns resolves once file is written or rejects with an error
 */


function writeDataToFile(filePath, data, mode) {
  var options = {
    encoding: 'utf8'
  };

  if (mode !== null) {
    options.mode = mode;
  }

  return new Promise(function (resolve, reject) {
    (0, _fs.writeFile)(filePath, data, options, function (err) {
      if (err) {
        reject(new Error(`Failed to write file ${filePath}`));
      }

      resolve();
    });
  });
}
/**
 * Spin up worker process.
 * @param argv - command line arguments
 */


function _default(argv) {
  var output = argv.output,
      source = argv.source,
      target = argv.target,
      verbose = argv.verbose; // Make sure source does not have a trailing separator

  if (source[source.length - 1] === _path.default.sep) {
    source = source.substr(0, source.length - 1);
  } // Make sure output does not have a trailing separator


  if (output[output.length - 1] === _path.default.sep) {
    output = output.substr(0, output.length - 1);
  } // eslint-disable-next-line flowtype/no-weak-types


  getBabelConfig(target, function (babelConfig) {
    process.on('message', processActionFromMater.bind(null, source, output, verbose, babelConfig));
  });
}