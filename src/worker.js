/**
 * @flow
 */

/* global ErrnoError */

import {transform} from 'babel-core'
import {
  createReadStream,
  createWriteStream,
  readFile,
  stat,
  unlink,
  writeFile,
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
import type {Argv} from './types'

type WriteOptions = {|
  encoding?: ?string,
  flag?: string,
  mode?: number,
|}

function send(...args) {
  if (process.send) {
    process.send(...args)
  } else {
    throw new Error('process.send is not defined')
  }
}

/**
 * Copy file.
 * @param filePath - full path of file to copy
 * @param outputFilePath - path to copy file to
 * @returns resolves once file has been copied or rejects with error
 */
function copyFile(filePath: string, outputFilePath: string): Promise<void> {
  return new Promise((resolve: () => void, reject: (err: Error) => void) => {
    stat(filePath, (err: ?ErrnoError, stats) => {
      const writeStreamOptions = {}

      if (!err) {
        writeStreamOptions.mode = stats.mode
      }

      const readStream = createReadStream(filePath)
      const writeStream = createWriteStream(outputFilePath, writeStreamOptions)

      readStream.on('error', (err: Error) => {
        reject(err)
      })

      writeStream
        .on('error', (err: Error) => {
          reject(err)
        })
        .on('finish', () => {
          resolve()
        })

      readStream.pipe(writeStream)
    })
  })
}

/**
 * Create output directory for file if it doesn't already exist.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path to source file
 * @returns resolves with output file path or rejects with error
 */
function createDirectoryForFile(
  source: string,
  output: string,
  filePath: string,
): Promise<string> {
  const relativeFilePath = path.relative(source, filePath)
  const relativeDirectoryPath = path.dirname(relativeFilePath)
  const outputDirectoryPath = path.join(output, relativeDirectoryPath)

  return new Promise(
    (
      resolve: (outputFilePath: string) => void,
      reject: (err: Error) => void,
    ) => {
      mkdirp(outputDirectoryPath, (err: ?Error) => {
        if (err) {
          throw new Error(`Failed to create directory ${outputDirectoryPath}`)
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
 */
function error(message: string) {
  console.error(message)

  send({
    erred: true,
    type: IDLE,
  })
}

/**
 * Get contents of a file.
 * @param filePath - full path of file to get contents of
 * @returns resolves with file contents or rejects with error
 */
function getFileContents(filePath: string): Promise<string> {
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
 * @param source - source directory
 * @param output - output directory
 * @param verbose - whether or not to have verbose logging
 * @param target - Node target
 * @param data - action from master
 */
function processActionFromMater(
  source: string,
  output: string,
  verbose: boolean,
  target: string,
  data: RemoveFileAction | TransformFileAction,
) {
  if (typeof data !== 'object') {
    return error(
      `Expected message from master to be an object but instead received type ${typeof data}`,
    )
  }

  if (data === null) {
    return error(
      'Expected message from master to be present but instead received null',
    )
  }

  switch (data.type) {
    case REMOVE_FILE:
      return removeOutputFile(source, output, data.filePath, verbose)

    case TRANSFORM_FILE:
      return transformFile(source, output, data.filePath, verbose, target)

    default:
      return error(`Master sent message with unknown action type ${data.type}`)
  }
}

/**
 * Remove file.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 * @param verbose - whether or not to have verbose logging
 */
function removeOutputFile(
  source: string,
  output: string,
  filePath: string,
  verbose: boolean,
) {
  const relativeFilePath = path.relative(source, filePath)
  const relativeDirectoryPath = path.dirname(relativeFilePath)
  const outputDirectoryPath = path.join(output, relativeDirectoryPath)
  const fileName = path.basename(filePath)
  const outputFilePath = path.join(outputDirectoryPath, fileName)

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
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 * @param verbose - whether or not to have verbose logging
 * @param target - Node target
 */
function transformFile(
  source: string,
  output: string,
  filePath: string,
  verbose: boolean,
  target: string,
) {
  createDirectoryForFile(source, output, filePath)
    .then((outputFilePath: string) => {
      const extension = path.extname(filePath)

      switch (extension) {
        case '': // Ignoring empty directories
          return null

        case '.js':
          return transformJavascriptFile(filePath, outputFilePath, target)

        default:
          return copyFile(filePath, outputFilePath)
      }
    })
    .then(() => false)
    .catch((err: Error) => {
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
 * @param target - Node target
 * @returns resolves once file has been written or rejects with error
 */
function transformJavascriptFile(
  filePath: string,
  outputFilePath: string,
  target: string,
): Promise<void> {
  return getFileContents(filePath).then((contents: string) => {
    return new Promise((resolve, reject) => {
      stat(filePath, (err1, stats) => {
        const mode = err1 ? null : stats.mode
        const result = transform(contents, {
          presets: [
            [
              'env',
              {
                targets: {
                  node: target,
                },
              },
            ],
            'react',
          ],
        })

        writeDataToFile(outputFilePath, result.code, mode)
          .then(() => {
            resolve()
          })
          .catch((err2: Error) => {
            reject(err2)
          })
      })
    })
  })
}

/**
 * Write data to file.
 * @param data - data to write
 * @param filePath - path of file to write to
 * @param mode - permission and sticky bits
 * @returns resolves once file is written or rejects with an error
 */
function writeDataToFile(
  filePath: string,
  data: string,
  mode: ?number,
): Promise<void> {
  const options: WriteOptions = {
    encoding: 'utf8',
  }

  if (mode !== null) {
    options.mode = mode
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

/**
 * Spin up worker process.
 * @param argv - command line arguments
 */
export default function(argv: Argv) {
  let {output, source, target, verbose} = argv

  // Make sure source does not have a trailing separator
  if (source[source.length - 1] === path.sep) {
    source = source.substr(0, source.length - 1)
  }

  // Make sure output does not have a trailing separator
  if (output[output.length - 1] === path.sep) {
    output = output.substr(0, output.length - 1)
  }

  process.on(
    'message',
    processActionFromMater.bind(null, source, output, verbose, target),
  )
}
