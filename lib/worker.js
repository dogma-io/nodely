"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.worker = worker;

var _core = require("@babel/core");

var _fs = require("fs");

var _mkdirp = _interopRequireDefault(require("mkdirp"));

var _path = _interopRequireDefault(require("path"));

var _actions = require("./actions");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* global ErrnoError */

/**
 * Copy file.
 * @param filePath - full path of file to copy
 * @param outputFilePath - path to copy file to
 * @param verbose - whether or not to have verbose logging
 * @returns resolves once file has been copied or rejects with error
 */
function copyFile(filePath, outputFilePath, verbose) {
  let readStream;
  let writeStream;
  return new Promise((resolve, reject) => {
    (0, _fs.stat)(filePath, (err, stats) => {
      const writeStreamOptions = {};

      if (!err) {
        writeStreamOptions.mode = stats.mode;
      }

      readStream = (0, _fs.createReadStream)(filePath);
      writeStream = (0, _fs.createWriteStream)(outputFilePath, writeStreamOptions);
      readStream.on('error', err2 => {
        if (verbose) {
          console.error(`Failed reading ${filePath}`);
        }

        reject(err2);
      });
      writeStream.on('error', err2 => {
        if (verbose) {
          console.error(`Failed writing ${outputFilePath}`);
        }

        reject(err2);
      }).on('finish', () => {
        resolve();
      });
      readStream.pipe(writeStream);
    });
  }).catch(err => {
    // NOTE: destroy was added in Node v8.0.0 and thus we need the if check
    // until Node 8 becomes the minimum versions supported by this project.
    // $FlowFixMe - Flow doesn't know about the destroy() method
    if (readStream && readStream.destroy) {
      readStream.destroy();
    }

    if (writeStream) {
      writeStream.end();
    }

    throw err;
  });
}
/**
 * Create output directory for file if it doesn't already exist.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path to source file
 * @param verbose - whether or not to have verbose logging
 * @returns resolves with output file path or rejects with error
 */


function createDirectoryForFile(source, output, filePath, verbose) {
  const relativeFilePath = _path.default.relative(source, filePath);

  const relativeDirectoryPath = _path.default.dirname(relativeFilePath);

  const outputDirectoryPath = _path.default.join(output, relativeDirectoryPath);

  if (verbose) {
    console.info(`Making sure directory ${source} exists…`);
  }

  return new Promise((resolve, reject) => {
    (0, _mkdirp.default)(outputDirectoryPath, err => {
      if (err) {
        reject(Error(`Failed to create directory ${outputDirectoryPath}`));
      }

      const fileName = _path.default.basename(filePath);

      const outputFilePath = _path.default.join(outputDirectoryPath, fileName);

      resolve(outputFilePath);
    });
  });
}
/**
 * Log error and inform master worker is now idle again.
 * @param message - error message
 * @param send - process send method
 */


function error(message, send) {
  console.error(message);
  send({
    erred: true,
    type: _actions.IDLE
  });
}
/* eslint-disable flowtype/no-weak-types */

/**
 * Get Babel configuration for transforming Javascript files
 * @param target - Node target
 * @returns Babel configuration
 */


function getBabelConfig(target) {
  const cwd = process.cwd();
  return new Promise((resolve, reject) => {
    (0, _fs.readdir)(cwd, (err, files) => {
      if (!err) {
        const configFile = files.find(fileName => {
          return /^\.babelrc(\.[a-zA-Z]+)?$/.test(fileName);
        });

        if (configFile) {
          const filePath = _path.default.join(cwd, configFile);

          switch (_path.default.extname(configFile)) {
            case '.js':
              try {
                // $FlowFixMe - Flow doesn't like dynamic require statements
                resolve(require(filePath));
              } catch (err3) {
                reject(err3);
              }

              return;

            case '.json':
              (0, _fs.readFile)(filePath, 'utf8', (err2, data) => {
                if (err2) {
                  reject(err2);
                } else {
                  try {
                    resolve(JSON.parse(data));
                  } catch (err3) {
                    reject(err3);
                  }
                }
              });
              return;
          }
        }
      }

      resolve({
        presets: [['@babel/env', {
          targets: {
            node: target
          }
        }], '@babel/flow', '@babel/react']
      });
    });
  });
}
/* eslint-enable flowtype/no-weak-types */

/**
 * Get contents of a file.
 * @param filePath - full path of file to get contents of
 * @param verbose - whether or not to have verbose logging
 * @returns resolves with file contents or rejects with error
 */


function getFileContents(filePath, verbose) {
  if (verbose) {
    console.info(`Getting contents of ${filePath}…`);
  }

  return new Promise((resolve, reject) => {
    (0, _fs.readFile)(filePath, 'utf8', (err, data) => {
      if (err) {
        reject(new Error(`Failed to get contents of file ${filePath}`));
      }

      resolve(data);
    });
  });
}
/**
 * Process actions from master.
 * @param includeRegex - included files regex
 * @param source - source directory
 * @param output - output directory
 * @param verbose - whether or not to have verbose logging
 * @param babelConfig - Babel config
 * @param send - process send method
 * @param data - action from master
 */


function processActionFromMaster(includeRegex, source, output, verbose, babelConfig, // eslint-disable-line flowtype/no-weak-types
send, data) {
  if (typeof data !== 'object') {
    return error(`Expected message from master to be an object but instead received type ${typeof data}`, send);
  }

  if (data === null) {
    return error('Expected message from master to be present but instead received null', send);
  }

  switch (data.type) {
    case _actions.REMOVE_FILE:
      return removeOutputFile(source, output, data.filePath, verbose, send);

    case _actions.TRANSFORM_FILE:
      return transformFile(includeRegex, source, output, data.filePath, verbose, babelConfig, send);

    default:
      return error(`Master sent message with unknown action type ${data.type}`, send);
  }
}
/**
 * Remove file.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 * @param verbose - whether or not to have verbose logging
 * @param send - process send method
 */


function removeOutputFile(source, output, filePath, verbose, send) {
  const relativeFilePath = _path.default.relative(source, filePath);

  const relativeDirectoryPath = _path.default.dirname(relativeFilePath);

  const outputDirectoryPath = _path.default.join(output, relativeDirectoryPath);

  const fileName = _path.default.basename(filePath);

  const outputFilePath = _path.default.join(outputDirectoryPath, fileName);

  if (verbose) {
    console.info(`Removing ${outputFilePath}`);
  }

  (0, _fs.unlink)(outputFilePath, err => {
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
 * @param includeRegex - included files regex
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 * @param verbose - whether or not to have verbose logging
 * @param babelConfig - Babel configuration
 * @param send - process send method
 */


function transformFile(includeRegex, source, output, filePath, verbose, babelConfig, // eslint-disable-line flowtype/no-weak-types
send) {
  const extension = _path.default.extname(filePath);

  if (includeRegex && !includeRegex.test(filePath)) {
    send({
      erred: false,
      type: _actions.IDLE
    });
    return;
  }

  createDirectoryForFile(source, output, filePath, verbose).then(outputFilePath => {
    switch (extension) {
      case '':
        // Ignoring empty directories
        return;

      case '.js':
        return transformJavascriptFile(filePath, outputFilePath, verbose, babelConfig);

      default:
        return copyFile(filePath, outputFilePath, verbose);
    }
  }).then(() => {
    return false;
  }).catch(err => {
    console.error(`Failed to process file ${filePath}`);

    if (verbose) {
      console.error(err);
    }

    return true;
  }).then(erred => {
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
 * @param verbose - whether or not to have verbose logging
 * @param babelConfig - Babel configuration
 * @returns resolves once file has been written or rejects with error
 */


function transformJavascriptFile(filePath, outputFilePath, verbose, babelConfig) {
  /* eslint-disable flowtype/generic-spacing */
  return getFileContents(filePath, verbose).then(contents => {
    return new Promise((resolve, reject) => {
      (0, _fs.stat)(filePath, (err1, stats) => {
        const mode = err1 ? null : stats.mode;

        if (verbose) {
          console.info(`Transforming ${filePath}…`);
        }

        (0, _core.transform)(contents, Object.assign({
          filename: filePath
        }, babelConfig), (err2, result) => {
          if (err2) {
            if (verbose) {
              console.error(`Failed to transform ${filePath}`);
            }

            reject(err2);
          } else {
            writeDataToFile(outputFilePath, result.code, mode, verbose).then(resolve).catch(reject);
          }
        });
      });
    });
  });
  /* eslint-enable flowtype/generic-spacing */
}
/**
 * Write data to file.
 * @param data - data to write
 * @param filePath - path of file to write to
 * @param mode - permission and sticky bits
 * @param verbose - whether or not to have verbose logging
 * @returns resolves once file is written or rejects with an error
 */


function writeDataToFile(filePath, data, mode, verbose) {
  const options = {
    encoding: 'utf8'
  };

  if (mode !== null) {
    options.mode = mode;
  }

  if (verbose) {
    console.info(`Writing ${filePath}…`);
  }

  return new Promise((resolve, reject) => {
    (0, _fs.writeFile)(filePath, data, options, err => {
      if (err) {
        reject(new Error(`Failed to write file ${filePath}`));
      }

      resolve();
    });
  });
} // eslint-disable flowtype/no-weak-types

/**
 * Spin up worker process.
 * @param argv - command line arguments
 */


function worker(argv, on, // eslint-disable-line
send) {
  let include = argv.include,
      output = argv.output,
      source = argv.source,
      target = argv.target,
      verbose = argv.verbose;
  let includeRegex;

  if (include) {
    try {
      includeRegex = new RegExp(include);
    } catch (err) {
      return Promise.reject(new Error('Include option is an invalid regex.'));
    }
  } // Make sure source does not have a trailing separator


  if (source[source.length - 1] === _path.default.sep) {
    source = source.substr(0, source.length - 1);
  } // Make sure output does not have a trailing separator


  if (output[output.length - 1] === _path.default.sep) {
    output = output.substr(0, output.length - 1);
  }

  return getBabelConfig(target).then(babelConfig => {
    // eslint-disable-line
    on('message', processActionFromMaster.bind(null, includeRegex, source, output, verbose, babelConfig, send));
  }).then(() => {
    // Let master know we are now ready to start processing files
    send({
      erred: false,
      type: _actions.IDLE
    });
  });
}