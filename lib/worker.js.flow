/**
 * @flow
 */

/* global ErrnoError */

import {transform} from '@babel/core'
import {
  createReadStream,
  createWriteStream,
  readdir,
  readFile,
  type ReadStream,
  stat,
  type Stats,
  unlink,
  writeFile,
  type WriteStream,
} from 'fs'
import mkdirp from 'mkdirp'
import path from 'path'

import {
  IDLE,
  REMOVE_FILE,
  type RemoveFileAction,
  TRANSFORM_FILE,
  type TransformFileAction,
} from './actions'
import type {Argv, ProcessSend} from './types'

type WriteOptions = {|
  encoding?: ?string,
  flag?: string,
  mode?: number,
|}

/**
 * Copy file.
 * @param filePath - full path of file to copy
 * @param outputFilePath - path to copy file to
 * @param verbose - whether or not to have verbose logging
 * @returns resolves once file has been copied or rejects with error
 */
function copyFile(
  filePath: string,
  outputFilePath: string,
  verbose: boolean,
): Promise<void> {
  let readStream: ReadStream
  let writeStream: WriteStream

  return new Promise((resolve: () => void, reject: (err: Error) => void) => {
    stat(filePath, (err: ?ErrnoError, stats: Stats) => {
      const writeStreamOptions = {}

      if (!err) {
        writeStreamOptions.mode = stats.mode
      }

      readStream = createReadStream(filePath)
      writeStream = createWriteStream(outputFilePath, writeStreamOptions)

      readStream.on('error', (err2: Error) => {
        if (verbose) {
          console.error(`Failed reading ${filePath}`)
        }

        reject(err2)
      })

      writeStream
        .on('error', (err2: Error) => {
          if (verbose) {
            console.error(`Failed writing ${outputFilePath}`)
          }

          reject(err2)
        })
        .on('finish', () => {
          resolve()
        })

      readStream.pipe(writeStream)
    })
  }).catch((err: Error) => {
    // NOTE: destroy was added in Node v8.0.0 and thus we need the if check
    // until Node 8 becomes the minimum versions supported by this project.
    // $FlowFixMe - Flow doesn't know about the destroy() method
    if (readStream && readStream.destroy) {
      readStream.destroy()
    }

    if (writeStream) {
      writeStream.end()
    }

    throw err
  })
}

/**
 * Create output directory for file if it doesn't already exist.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path to source file
 * @param verbose - whether or not to have verbose logging
 * @returns resolves with output file path or rejects with error
 */
function createDirectoryForFile(
  source: string,
  output: string,
  filePath: string,
  verbose: boolean,
): Promise<string> {
  const relativeFilePath = path.relative(source, filePath)
  const relativeDirectoryPath = path.dirname(relativeFilePath)
  const outputDirectoryPath = path.join(output, relativeDirectoryPath)

  if (verbose) {
    console.info(`Making sure directory ${source} exists…`)
  }

  return new Promise(
    (
      resolve: (outputFilePath: string) => void,
      reject: (err: Error) => void,
    ) => {
      mkdirp(outputDirectoryPath, (err: ?Error) => {
        if (err) {
          reject(Error(`Failed to create directory ${outputDirectoryPath}`))
        }

        const fileName = path.basename(filePath)
        const outputFilePath = path.join(outputDirectoryPath, fileName)

        resolve(outputFilePath)
      })
    },
  )
}

/**
 * Log error and inform master worker is now idle again.
 * @param message - error message
 * @param send - process send method
 */
function error(message: string, send: ProcessSend) {
  console.error(message)

  send({
    erred: true,
    type: IDLE,
  })
}

/* eslint-disable flowtype/no-weak-types */
/**
 * Get Babel configuration for transforming Javascript files
 * @param target - Node target
 * @returns Babel configuration
 */
function getBabelConfig(target?: string): Promise<Object> {
  const cwd = process.cwd()

  return new Promise(
    (resolve: (babelConfig: Object) => void, reject: (err: Error) => void) => {
      readdir(cwd, (err: ?ErrnoError, files: Array<string>) => {
        if (!err) {
          const configFile = files.find((fileName: string): boolean => {
            return /^\.babelrc(\.[a-zA-Z]+)?$/.test(fileName)
          })

          if (configFile) {
            const filePath = path.join(cwd, configFile)

            switch (path.extname(configFile)) {
              case '.js':
                try {
                  // $FlowFixMe - Flow doesn't like dynamic require statements
                  resolve(require(filePath))
                } catch (err3) {
                  reject(err3)
                }
                return

              case '.json':
                readFile(
                  filePath,
                  'utf8',
                  (err2: ?ErrnoError, data: string) => {
                    if (err2) {
                      reject(err2)
                    } else {
                      try {
                        resolve(JSON.parse(data))
                      } catch (err3) {
                        reject(err3)
                      }
                    }
                  },
                )
                return
            }
          }
        }

        const env = target
          ? ['@babel/env', {targets: {node: target}}]
          : '@babel/env'

        resolve({
          presets: [env, '@babel/flow', '@babel/react'],
        })
      })
    },
  )
}
/* eslint-enable flowtype/no-weak-types */

/**
 * Get contents of a file.
 * @param filePath - full path of file to get contents of
 * @param verbose - whether or not to have verbose logging
 * @returns resolves with file contents or rejects with error
 */
function getFileContents(filePath: string, verbose: boolean): Promise<string> {
  if (verbose) {
    console.info(`Getting contents of ${filePath}…`)
  }

  return new Promise(
    (resolve: (data: string) => void, reject: (err: Error) => void) => {
      readFile(filePath, 'utf8', (err: ?Error, data: string) => {
        if (err) {
          reject(new Error(`Failed to get contents of file ${filePath}`))
        }

        resolve(data)
      })
    },
  )
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
function processActionFromMaster(
  includeRegex: ?RegExp,
  source: string,
  output: string,
  verbose: boolean,
  babelConfig: Object, // eslint-disable-line flowtype/no-weak-types
  send: ProcessSend,
  data: RemoveFileAction | TransformFileAction,
): void {
  if (typeof data !== 'object') {
    return error(
      `Expected message from master to be an object but instead received type ${typeof data}`,
      send,
    )
  }

  if (data === null) {
    return error(
      'Expected message from master to be present but instead received null',
      send,
    )
  }

  switch (data.type) {
    case REMOVE_FILE:
      return removeOutputFile(source, output, data.filePath, verbose, send)

    case TRANSFORM_FILE:
      return transformFile(
        includeRegex,
        source,
        output,
        data.filePath,
        verbose,
        babelConfig,
        send,
      )

    default:
      return error(
        `Master sent message with unknown action type ${data.type}`,
        send,
      )
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
function removeOutputFile(
  source: string,
  output: string,
  filePath: string,
  verbose: boolean,
  send: ProcessSend,
) {
  const relativeFilePath = path.relative(source, filePath)
  const relativeDirectoryPath = path.dirname(relativeFilePath)
  const outputDirectoryPath = path.join(output, relativeDirectoryPath)
  const fileName = path.basename(filePath)
  const outputFilePath = path.join(outputDirectoryPath, fileName)

  if (verbose) {
    console.info(`Removing ${outputFilePath}`)
  }

  unlink(outputFilePath, (err: ?Error) => {
    if (err) {
      console.error(`Failed to remove file ${outputFilePath}`)

      if (verbose) {
        console.error(err)
      }
    }

    send({
      erred: !!err,
      type: IDLE,
    })
  })
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
function transformFile(
  includeRegex: ?RegExp,
  source: string,
  output: string,
  filePath: string,
  verbose: boolean,
  babelConfig: Object, // eslint-disable-line flowtype/no-weak-types
  send: ProcessSend,
) {
  const extension = path.extname(filePath)

  if (includeRegex && !includeRegex.test(filePath)) {
    send({
      erred: false,
      type: IDLE,
    })
    return
  }

  createDirectoryForFile(source, output, filePath, verbose)
    .then((outputFilePath: string): ?Promise<void> => {
      switch (extension) {
        case '': // Ignoring empty directories
          return

        case '.js':
          return transformJavascriptFile(
            filePath,
            outputFilePath,
            verbose,
            babelConfig,
          )

        default:
          return copyFile(filePath, outputFilePath, verbose)
      }
    })
    .then((): boolean => {
      return false
    })
    .catch((err: Error): boolean => {
      console.error(`Failed to process file ${filePath}`)

      if (verbose) {
        console.error(err)
      }

      return true
    })
    .then((erred: boolean) => {
      send({
        erred,
        type: IDLE,
      })
    })
}

/**
 * Transform file.
 * @param filePath - full path of file to transform
 * @param outputFilePath - path to write transformed file to
 * @param verbose - whether or not to have verbose logging
 * @param babelConfig - Babel configuration
 * @returns resolves once file has been written or rejects with error
 */
function transformJavascriptFile(
  filePath: string,
  outputFilePath: string,
  verbose: boolean,
  babelConfig: Object, // eslint-disable-line flowtype/no-weak-types
): Promise<void> {
  /* eslint-disable flowtype/generic-spacing */
  return getFileContents(filePath, verbose).then(
    (contents: string): Promise<void> => {
      return new Promise(
        (resolve: () => void, reject: (err: Error) => void) => {
          stat(filePath, (err1: ?ErrnoError, stats: Stats) => {
            const mode = err1 ? null : stats.mode

            if (verbose) {
              console.info(`Transforming ${filePath}…`)
            }

            transform(
              contents,
              Object.assign({filename: filePath}, babelConfig),
              (err2: ?Error, result: {code: string}) => {
                if (err2) {
                  if (verbose) {
                    console.error(`Failed to transform ${filePath}`)
                  }

                  reject(err2)
                } else {
                  writeDataToFile(outputFilePath, result.code, mode, verbose)
                    .then(resolve)
                    .catch(reject)
                }
              },
            )
          })
        },
      )
    },
  )
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
function writeDataToFile(
  filePath: string,
  data: string,
  mode: ?number,
  verbose: boolean,
): Promise<void> {
  const options: WriteOptions = {
    encoding: 'utf8',
  }

  if (mode !== null) {
    options.mode = mode
  }

  if (verbose) {
    console.info(`Writing ${filePath}…`)
  }

  return new Promise((resolve: () => void, reject: (err: Error) => void) => {
    writeFile(filePath, data, options, (err: ?Error) => {
      if (err) {
        reject(new Error(`Failed to write file ${filePath}`))
      }

      resolve()
    })
  })
}

// eslint-disable flowtype/no-weak-types
/**
 * Spin up worker process.
 * @param argv - command line arguments
 */
export function worker(
  argv: Argv,
  on: (event: string, listener: Function) => mixed, // eslint-disable-line
  send: ProcessSend,
): Promise<void> {
  let {include, output, source, target, verbose} = argv

  let includeRegex

  if (include) {
    try {
      includeRegex = new RegExp(include)
    } catch (err) {
      return Promise.reject(new Error('Include option is an invalid regex.'))
    }
  }

  // Make sure source does not have a trailing separator
  if (source[source.length - 1] === path.sep) {
    source = source.substr(0, source.length - 1)
  }

  // Make sure output does not have a trailing separator
  if (output[output.length - 1] === path.sep) {
    output = output.substr(0, output.length - 1)
  }

  return getBabelConfig(target)
    .then((babelConfig: Object) => { // eslint-disable-line
      on(
        'message',
        processActionFromMaster.bind(
          null,
          includeRegex,
          source,
          output,
          verbose,
          babelConfig,
          send,
        ),
      )
    })
    .then(() => {
      // Let master know we are now ready to start processing files
      send({
        erred: false,
        type: IDLE,
      })
    })
}
