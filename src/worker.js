import {transform} from 'babel-core'
import {
  createReadStream,
  createWriteStream,
  readFile,
  removeFile,
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

const TRANSFORM_OPTIONS = Object.freeze({
  presets: ['es2015', 'react'],
})

/**
 * Copy file.
 * @param filePath - full path of file to copy
 * @param outputFilePath - path to copy file to
 * @returns resolves once file has been copied or rejects with error
 */
function copyFile(
  filePath: string,
  outputFilePath: string,
): Promise<void, Error> {
  return new Promise((resolve: () => void, reject: (err: Error) => void) => {
    const readStream = createReadStream(filePath)
    const writeStream = createWriteStream(outputFilePath)

    readStream.on('error', (err: Error) => {
      reject(err)
    })

    writeStream
      .on('error', (err: Error) => {
        reject(err)
      })
      .on('close', () => {
        resolve()
      })

    readStream.pipe(writeStream)
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
): Promise<string, Error> {
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
          reject(new Error(`Failed to create directory ${outputDirectoryPath}`))
        }

        const fileName = path.basename(filePath)
        const outputFilePath = path.join(outputDirectoryPath, fileName)

        resolve(outputFilePath)
      })
    },
  )
}

/**
 * Get contents of a file.
 * @param filePath - full path of file to get contents of
 * @returns resolves with file contents or rejects with error
 */
function getFileContents(filePath: string): Promise<string, Error> {
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
 * @param data - action from master
 */
function processActionFromMater(
  source: string,
  output: string,
  verbose: boolean,
  data: RemoveFileAction | TransformFileAction,
) {
  if (typeof data !== 'object') {
    throw new Error(
      `Expected message from master to be an object but instead received type ${typeof data}`,
    )
  }

  if (data === null) {
    throw new Error(
      'Expected message from master to be present but instead received null',
    )
  }

  switch (data.type) {
    case REMOVE_FILE:
      removeOutputFile(source, output, data.filePath)
      break

    case TRANSFORM_FILE:
      transformFile(source, output, data.filePath, verbose)
      break

    default:
      throw new Error(
        `Master sent message with unknown action type ${data.type}`,
      )
  }
}

/**
 * Remove file.
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 */
function removeOutputFile(source: string, output: string, filePath: string) {
  const relativeFilePath = path.relative(source, filePath)
  const relativeDirectoryPath = path.dirname(relativeFilePath)
  const outputDirectoryPath = path.join(output, relativeDirectoryPath)
  const fileName = path.basename(filePath)
  const outputFilePath = path.join(outputDirectoryPath, fileName)

  removeFile(outputFilePath, (err: ?Error) => {
    if (err) {
      throw err
    }

    process.send({
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
 */
function transformFile(
  source: string,
  output: string,
  filePath: string,
  verbose: boolean,
) {
  createDirectoryForFile(source, output, filePath)
    .then((outputFilePath: string) => {
      const extension = path.extname(filePath)

      switch (extension) {
        case '': // Ignoring empty directories
          return null

        case '.js':
          return transformJavascriptFile(filePath, outputFilePath)

        default:
          return copyFile(filePath, outputFilePath)
      }
    })
    .catch((err: Error) => {
      console.error(`Failed to process file ${filePath}`)

      if (verbose) {
        console.error(err)
      }
    })
    .then(() => {
      process.send({
        type: IDLE,
      })
    })
}

/**
 * Transform file.
 * @param filePath - full path of file to transform
 * @param outputFilePath - path to write transformed file to
 * @returns resolves once file has been written or rejects with error
 */
function transformJavascriptFile(
  filePath: string,
  outputFilePath: string,
): Promise<void, Error> {
  return getFileContents(filePath).then((contents: string) => {
    const result = transform(contents, TRANSFORM_OPTIONS)
    return writeDataToFile(outputFilePath, result.code)
  })
}

/**
 * Write data to file.
 * @param data - data to write
 * @param filePath - path of file to write to
 * @returns resolves once file is written or rejects with an error
 */
function writeDataToFile(filePath: string, data: string): Promise<void, Error> {
  return new Promise((resolve: () => void, reject: (err: Error) => void) => {
    writeFile(filePath, data, 'utf8', (err: ?Error) => {
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
  let {output, source, verbose} = argv

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
    processActionFromMater.bind(null, source, output, verbose),
  )
}
