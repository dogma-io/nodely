/**
 * @flow
 */

/* global ErrnoError */

import {transform} from 'babel-core'
import {
  createReadStream,
  createWriteStream,
  readdir,
  readFile,
  stat,
  type Stats,
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

type Action = {|
  erred: boolean,
  type: typeof IDLE,
|}

type WriteOptions = {|
  encoding?: ?string,
  flag?: string,
  mode?: number,
|}

function send(action: Action) {
  if (process.send) {
    process.send(action)
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
    stat(filePath, (err: ?ErrnoError, stats: Stats) => {
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
 * Get Babel configuration for transforming Javascript files
 * @param target - Node target
 * @returns Babel configuration
 */
function getBabelConfig(
  target: string,
  callback: (babelConfig: Object) => void, // eslint-disable-line flowtype/no-weak-types
) {
  const cwd = process.cwd()

  readdir(cwd, (err: ?ErrnoError, files: Array<string>) => {
    if (!err) {
      const configFile = files.find((fileName: string): boolean => {
        return /^\.babelrc(\.[a-zA-Z]+)?$/.test(fileName)
      })

      if (configFile) {
        const filePath = path.join(cwd, configFile)

        switch (path.extname(configFile)) {
          case '.js':
            // $FlowFixMe - Flow doesn't like dynamic require statements
            callback(require(filePath))
            return

          case '.json':
            readFile(filePath, 'utf8', (err2: ?ErrnoError, data: string) => {
              callback(JSON.parse(data))
            })
            return
        }
      }
    }

    // eslint-disable-next-line standard/no-callback-literal
    callback({
      presets: [
        [
          '@babel/env',
          {
            targets: {
              node: target,
            },
          },
        ],
        '@babel/flow',
        '@babel/react',
      ],
    })
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
 * @param includeRegex - included files regex
 * @param source - source directory
 * @param output - output directory
 * @param verbose - whether or not to have verbose logging
 * @param babelConfig - Babel config
 * @param data - action from master
 */
function processActionFromMater(
  includeRegex: ?RegExp,
  source: string,
  output: string,
  verbose: boolean,
  babelConfig: Object, // eslint-disable-line flowtype/no-weak-types
  data: RemoveFileAction | TransformFileAction,
): void {
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
      return transformFile(
        includeRegex,
        source,
        output,
        data.filePath,
        verbose,
        babelConfig,
      )

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
 * @param includeRegex - included files regex
 * @param source - source directory
 * @param output - output directory
 * @param filePath - full path of file to transform
 * @param verbose - whether or not to have verbose logging
 * @param babelConfig - Babel configuration
 */
function transformFile(
  includeRegex: ?RegExp,
  source: string,
  output: string,
  filePath: string,
  verbose: boolean,
  babelConfig: Object, // eslint-disable-line flowtype/no-weak-types
) {
  const extension = path.extname(filePath)

  if (includeRegex && !includeRegex.test(filePath)) {
    send({
      erred: false,
      type: IDLE,
    })
    return
  }

  createDirectoryForFile(source, output, filePath)
    .then((outputFilePath: string): ?Promise<void> => {
      switch (extension) {
        case '': // Ignoring empty directories
          return

        case '.js':
          return transformJavascriptFile(filePath, outputFilePath, babelConfig)

        default:
          return copyFile(filePath, outputFilePath)
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
 * @param babelConfig - Babel configuration
 * @returns resolves once file has been written or rejects with error
 */
function transformJavascriptFile(
  filePath: string,
  outputFilePath: string,
  babelConfig: Object, // eslint-disable-line flowtype/no-weak-types
): Promise<void> {
  return getFileContents(filePath).then((contents: string): Promise<void> => {
    return new Promise((resolve: () => void, reject: (err: Error) => void) => {
      stat(filePath, (err1: ?ErrnoError, stats: Stats) => {
        const mode = err1 ? null : stats.mode
        const result = transform(
          contents,
          Object.assign({filename: filePath}, babelConfig),
        )

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
  let {include, output, source, target, verbose} = argv

  let includeRegex

  if (include) {
    try {
      includeRegex = new RegExp(include)
    } catch (err) {
      throw new Error('Include option is an invalid regex.')
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

  // eslint-disable-next-line flowtype/no-weak-types
  getBabelConfig(target, (babelConfig: Object) => {
    process.on(
      'message',
      processActionFromMater.bind(
        null,
        includeRegex,
        source,
        output,
        verbose,
        babelConfig,
      ),
    )
  })
}
