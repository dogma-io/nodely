jest.mock('babel-core')

jest.mock('fs', () => {
  return {
    createReadStream: jest.fn(),
    createWriteStream: jest.fn(),
    readFile: jest.fn(),
    removeFile: jest.fn(),
    writeFile: jest.fn(),
  }
})

jest.mock('mkdirp')

import {transform} from 'babel-core'
import {
  createReadStream,
  createWriteStream,
  readFile,
  removeFile,
  writeFile,
} from 'fs'
import mkdirp from 'mkdirp'
import {Readable, Writable} from 'stream'
import {IDLE, REMOVE_FILE, TRANSFORM_FILE} from '../actions'
import worker from '../worker'

const TRANSFORM_OPTIONS = Object.freeze({
  presets: [
    [
      'env',
      {
        targets: {
          node: '4', // In maintenance LTS
        },
      },
    ],
    'react',
  ],
})

function tests(ctx, description, argv) {
  describe(description, () => {
    beforeEach(() => {
      worker(argv)
    })

    it('functions as expected', () => {
      expect(process.on).toHaveBeenCalledTimes(1)
      expect(process.on).toHaveBeenCalledWith('message', expect.any(Function))
    })

    it('functions as expected when master sends non-object message', () => {
      expect(ctx.listeners.message).toHaveLength(1)
      ctx.listeners.message[0]('test')
      expect(console.error).toHaveBeenCalledTimes(1)
      expect(console.error).toHaveBeenCalledWith(
        'Expected message from master to be an object but instead received type string',
      )
      expect(process.send).toHaveBeenCalledTimes(1)
      expect(process.send).toHaveBeenCalledWith({
        erred: true,
        type: IDLE,
      })
    })

    it('functions as expected when master sends null message', () => {
      expect(ctx.listeners.message).toHaveLength(1)
      ctx.listeners.message[0](null)
      expect(console.error).toHaveBeenCalledTimes(1)
      expect(console.error).toHaveBeenCalledWith(
        'Expected message from master to be present but instead received null',
      )
      expect(process.send).toHaveBeenCalledTimes(1)
      expect(process.send).toHaveBeenCalledWith({
        erred: true,
        type: IDLE,
      })
    })

    it('functions as expected when master sends message with unknown action type', () => {
      expect(ctx.listeners.message).toHaveLength(1)
      ctx.listeners.message[0]({type: 'FOO_BAR'})
      expect(console.error).toHaveBeenCalledTimes(1)
      expect(console.error).toHaveBeenCalledWith(
        'Master sent message with unknown action type FOO_BAR',
      )
      expect(process.send).toHaveBeenCalledTimes(1)
      expect(process.send).toHaveBeenCalledWith({
        erred: true,
        type: IDLE,
      })
    })

    describe('when master sends message to remove file', () => {
      it('functions as expected when fails to remove file', () => {
        const error = new Error('foo bar')

        removeFile.mockImplementation((...args) => {
          const callback = args[args.length - 1]
          callback(error)
        })

        expect(ctx.listeners.message).toHaveLength(1)

        ctx.listeners.message[0]({
          filePath: '/foo/alpha/bravo.js',
          type: REMOVE_FILE,
        })

        expect(console.error).toHaveBeenCalledTimes(argv.verbose ? 2 : 1)
        expect(console.error).toHaveBeenCalledWith(
          'Failed to remove file /bar/alpha/bravo.js',
        )

        if (argv.verbose) {
          expect(console.error).toHaveBeenCalledWith(error)
        }

        expect(process.send).toHaveBeenCalledTimes(1)
        expect(process.send).toHaveBeenCalledWith({
          erred: true,
          type: IDLE,
        })
      })

      it('functions as expected when successfully removes file', () => {
        removeFile.mockImplementation((...args) => {
          const callback = args[args.length - 1]
          callback(null)
        })
        expect(ctx.listeners.message).toHaveLength(1)
        ctx.listeners.message[0]({
          filePath: '/foo/alpha/bravo.js',
          type: REMOVE_FILE,
        })
        expect(console.error).toHaveBeenCalledTimes(0)
        expect(process.send).toHaveBeenCalledTimes(1)
        expect(process.send).toHaveBeenCalledWith({
          erred: false,
          type: IDLE,
        })
      })
    })

    describe('when master sends message to transform file', () => {
      it('functions as expected when it fails to create directory for file', done => {
        const error = new Error('foo bar')

        mkdirp.mockImplementation((...args) => {
          const callback = args[args.length - 1]
          callback(error)
        })

        expect(ctx.listeners.message).toHaveLength(1)

        ctx.listeners.message[0]({
          filePath: '/foo/alpha/bravo.js',
          type: TRANSFORM_FILE,
        })

        process.nextTick(() => {
          expect(mkdirp).toHaveBeenCalledTimes(1)
          expect(mkdirp).toHaveBeenCalledWith(
            '/bar/alpha',
            expect.any(Function),
          )
          expect(console.error).toHaveBeenCalledTimes(argv.verbose ? 2 : 1)
          expect(console.error).toHaveBeenCalledWith(
            'Failed to process file /foo/alpha/bravo.js',
          )

          if (argv.verbose) {
            expect(console.error).toHaveBeenCalledWith(
              new Error('Failed to create directory /bar/alpha'),
            )
          }

          expect(process.send).toHaveBeenCalledTimes(1)
          expect(process.send).toHaveBeenCalledWith({
            erred: true,
            type: IDLE,
          })

          done()
        })
      })

      describe('when it successfully creates directory for file', () => {
        beforeEach(() => {
          mkdirp.mockImplementation((...args) => {
            const callback = args[args.length - 1]
            callback(null)
          })
        })

        it('functions as expected when file is actually a directory', done => {
          expect(ctx.listeners.message).toHaveLength(1)

          ctx.listeners.message[0]({
            filePath: '/foo/alpha',
            type: TRANSFORM_FILE,
          })

          process.nextTick(() => {
            expect(mkdirp).toHaveBeenCalledTimes(1)
            expect(mkdirp).toHaveBeenCalledWith('/bar', expect.any(Function))
            expect(console.error).toHaveBeenCalledTimes(0)
            expect(process.send).toHaveBeenCalledTimes(1)
            expect(process.send).toHaveBeenCalledWith({
              erred: false,
              type: IDLE,
            })
            done()
          })
        })

        describe('when file is a Javascript file', () => {
          it('functions as expected when it fails to read source file', () => {
            const error = new Error('foo bar')

            readFile.mockImplementation((...args) => {
              const callback = args[args.length - 1]
              callback(error)
            })

            expect(ctx.listeners.message).toHaveLength(1)

            ctx.listeners.message[0]({
              filePath: '/foo/alpha/bravo.js',
              type: TRANSFORM_FILE,
            })

            setTimeout(() => {
              expect(mkdirp).toHaveBeenCalledTimes(1)
              expect(mkdirp).toHaveBeenCalledWith(
                '/bar/alpha',
                expect.any(Function),
              )
              expect(readFile).toHaveBeenCalledTimes(1)
              expect(readFile).toHaveBeenCalledWith(
                '/foo/alpha/bravo.js',
                'utf8',
                expect.any(Function),
              )
              expect(transform).toHaveBeenCalledTimes(0)
              expect(console.error).toHaveBeenCalledTimes(argv.verbose ? 2 : 1)
              expect(console.error).toHaveBeenCalledWith(
                'Failed to process file /foo/alpha/bravo.js',
              )

              if (argv.verbose) {
                expect(console.error).toHaveBeenCalledWith(
                  'Failed to get contents of file /foo/alpha/bravo.js',
                )
              }

              expect(process.send).toHaveBeenCalledTimes(1)
              expect(process.send).toHaveBeenCalledWith({
                erred: true,
                type: IDLE,
              })
            }, 1)
          })

          describe('when it successfully reads source file', () => {
            let contents

            beforeEach(() => {
              const contents = 'blah blah blah'

              readFile.mockImplementation((...args) => {
                const callback = args[args.length - 1]
                callback(null, contents)
              })
            })

            it('functions as expected when it fails to transform file contents', () => {
              const error = new Error('foo bar')

              transform.mockImplementation(() => {
                throw error
              })

              expect(ctx.listeners.message).toHaveLength(1)

              ctx.listeners.message[0]({
                filePath: '/foo/alpha/bravo.js',
                type: TRANSFORM_FILE,
              })

              setTimeout(() => {
                expect(mkdirp).toHaveBeenCalledTimes(1)
                expect(mkdirp).toHaveBeenCalledWith(
                  '/bar/alpha',
                  expect.any(Function),
                )
                expect(readFile).toHaveBeenCalledTimes(1)
                expect(readFile).toHaveBeenCalledWith(
                  '/foo/alpha/bravo.js',
                  'utf8',
                  expect.any(Function),
                )
                expect(transform).toHaveBeenCalledTimes(1)
                expect(transform).toHaveBeenCalledWith(
                  contents,
                  TRANSFORM_OPTIONS,
                )
                expect(console.error).toHaveBeenCalledTimes(
                  argv.verbose ? 2 : 1,
                )
                expect(console.error).toHaveBeenCalledWith(
                  'Failed to process file /foo/alpha/bravo.js',
                )

                if (argv.verbose) {
                  expect(console.error).toHaveBeenCalledWith(error)
                }

                expect(process.send).toHaveBeenCalledTimes(1)
                expect(process.send).toHaveBeenCalledWith({
                  erred: true,
                  type: IDLE,
                })
              }, 1)
            })

            describe('when it succssfully transforms file contents', () => {
              beforeEach(() => {
                transform.mockImplementation(code => {
                  return {code}
                })
              })

              it('functions as expected when it fails to write transformed contents to file', () => {
                const error = new Error('foo bar')

                writeFile.mockImplementation((...args) => {
                  const callback = args[args.length - 1]
                  callback(error)
                })

                expect(ctx.listeners.message).toHaveLength(1)

                ctx.listeners.message[0]({
                  filePath: '/foo/alpha/bravo.js',
                  type: TRANSFORM_FILE,
                })

                setTimeout(() => {
                  expect(mkdirp).toHaveBeenCalledTimes(1)
                  expect(mkdirp).toHaveBeenCalledWith(
                    '/bar/alpha',
                    expect.any(Function),
                  )
                  expect(readFile).toHaveBeenCalledTimes(1)
                  expect(readFile).toHaveBeenCalledWith(
                    '/foo/alpha/bravo.js',
                    'utf8',
                    expect.any(Function),
                  )
                  expect(transform).toHaveBeenCalledTimes(1)
                  expect(transform).toHaveBeenCalledWith(
                    contents,
                    TRANSFORM_OPTIONS,
                  )
                  expect(console.error).toHaveBeenCalledTimes(
                    argv.verbose ? 2 : 1,
                  )
                  expect(console.error).toHaveBeenCalledWith(
                    'Failed to process file /foo/alpha/bravo.js',
                  )

                  if (argv.verbose) {
                    expect(console.error).toHaveBeenCalledWith(
                      'Failed to write file /foo/alpha/bravo.js',
                    )
                  }

                  expect(process.send).toHaveBeenCalledTimes(1)
                  expect(process.send).toHaveBeenCalledWith({
                    erred: true,
                    type: IDLE,
                  })
                }, 1)
              })

              it('functions as expected when it successfully writes transformed contents to file', () => {
                writeFile.mockImplementation((...args) => {
                  const callback = args[args.length - 1]
                  callback(null)
                })

                expect(ctx.listeners.message).toHaveLength(1)

                ctx.listeners.message[0]({
                  filePath: '/foo/alpha/bravo.js',
                  type: TRANSFORM_FILE,
                })

                setTimeout(() => {
                  expect(mkdirp).toHaveBeenCalledTimes(1)
                  expect(mkdirp).toHaveBeenCalledWith(
                    '/bar/alpha',
                    expect.any(Function),
                  )
                  expect(readFile).toHaveBeenCalledTimes(1)
                  expect(readFile).toHaveBeenCalledWith(
                    '/foo/alpha/bravo.js',
                    'utf8',
                    expect.any(Function),
                  )
                  expect(transform).toHaveBeenCalledTimes(1)
                  expect(transform).toHaveBeenCalledWith(
                    contents,
                    TRANSFORM_OPTIONS,
                  )
                  expect(console.error).toHaveBeenCalledTimes(0)
                  expect(process.send).toHaveBeenCalledTimes(1)
                  expect(process.send).toHaveBeenCalledWith({
                    erred: false,
                    type: IDLE,
                  })
                }, 1)
              })
            })
          })
        })

        describe('when file is not a Javascript file', () => {
          it('functions as expected when it fails to create read stream', done => {
            const error = new Error('foo bar')

            createReadStream.mockImplementation(() => {
              throw error
            })

            expect(ctx.listeners.message).toHaveLength(1)

            ctx.listeners.message[0]({
              filePath: '/foo/alpha/bravo.json',
              type: TRANSFORM_FILE,
            })

            process.nextTick(() => {
              expect(mkdirp).toHaveBeenCalledTimes(1)
              expect(mkdirp).toHaveBeenCalledWith(
                '/bar/alpha',
                expect.any(Function),
              )
              expect(console.error).toHaveBeenCalledTimes(argv.verbose ? 2 : 1)
              expect(console.error).toHaveBeenCalledWith(
                'Failed to process file /foo/alpha/bravo.json',
              )

              if (argv.verbose) {
                expect(console.error).toHaveBeenCalledWith(error)
              }

              expect(process.send).toHaveBeenCalledTimes(1)
              expect(process.send).toHaveBeenCalledWith({
                erred: true,
                type: IDLE,
              })

              done()
            })
          })

          it('functions as expected when it fails to create write stream', done => {
            const error = new Error('foo bar')
            const readStream = new Readable({read: jest.fn()})

            createReadStream.mockReturnValue(readStream)
            createWriteStream.mockImplementation(() => {
              throw error
            })

            expect(ctx.listeners.message).toHaveLength(1)

            ctx.listeners.message[0]({
              filePath: '/foo/alpha/bravo.json',
              type: TRANSFORM_FILE,
            })

            process.nextTick(() => {
              expect(mkdirp).toHaveBeenCalledTimes(1)
              expect(mkdirp).toHaveBeenCalledWith(
                '/bar/alpha',
                expect.any(Function),
              )
              expect(console.error).toHaveBeenCalledTimes(argv.verbose ? 2 : 1)
              expect(console.error).toHaveBeenCalledWith(
                'Failed to process file /foo/alpha/bravo.json',
              )

              if (argv.verbose) {
                expect(console.error).toHaveBeenCalledWith(error)
              }

              expect(process.send).toHaveBeenCalledTimes(1)
              expect(process.send).toHaveBeenCalledWith({
                erred: true,
                type: IDLE,
              })

              done()
            })
          })

          it('functions as expected when read stream receives an error', done => {
            const error = new Error('foo bar')
            const readStream = new Readable({read: jest.fn()})
            const writeStream = new Writable({write: jest.fn()})

            createReadStream.mockReturnValue(readStream)
            createWriteStream.mockReturnValue(writeStream)

            expect(ctx.listeners.message).toHaveLength(1)

            ctx.listeners.message[0]({
              filePath: '/foo/alpha/bravo.json',
              type: TRANSFORM_FILE,
            })

            readStream.destroy(error)

            process.nextTick(() => {
              process.nextTick(() => {
                expect(mkdirp).toHaveBeenCalledTimes(1)
                expect(mkdirp).toHaveBeenCalledWith(
                  '/bar/alpha',
                  expect.any(Function),
                )
                expect(console.error).toHaveBeenCalledTimes(
                  argv.verbose ? 2 : 1,
                )
                expect(console.error).toHaveBeenCalledWith(
                  'Failed to process file /foo/alpha/bravo.json',
                )

                if (argv.verbose) {
                  expect(console.error).toHaveBeenCalledWith(error)
                }

                expect(process.send).toHaveBeenCalledTimes(1)
                expect(process.send).toHaveBeenCalledWith({
                  erred: true,
                  type: IDLE,
                })

                done()
              })
            })
          })

          it('functions as expected when write stream receives an error', done => {
            const error = new Error('foo bar')
            const readStream = new Readable({read: jest.fn()})
            const writeStream = new Writable({write: jest.fn()})

            createReadStream.mockReturnValue(readStream)
            createWriteStream.mockReturnValue(writeStream)

            expect(ctx.listeners.message).toHaveLength(1)

            ctx.listeners.message[0]({
              filePath: '/foo/alpha/bravo.json',
              type: TRANSFORM_FILE,
            })

            writeStream.destroy(error)

            process.nextTick(() => {
              process.nextTick(() => {
                expect(mkdirp).toHaveBeenCalledTimes(1)
                expect(mkdirp).toHaveBeenCalledWith(
                  '/bar/alpha',
                  expect.any(Function),
                )
                expect(console.error).toHaveBeenCalledTimes(
                  argv.verbose ? 2 : 1,
                )
                expect(console.error).toHaveBeenCalledWith(
                  'Failed to process file /foo/alpha/bravo.json',
                )

                if (argv.verbose) {
                  expect(console.error).toHaveBeenCalledWith(error)
                }

                expect(process.send).toHaveBeenCalledTimes(1)
                expect(process.send).toHaveBeenCalledWith({
                  erred: true,
                  type: IDLE,
                })

                done()
              })
            })
          })

          it('functions as expected when file is successfully copied', done => {
            const readStream = new Readable({read: jest.fn()})
            const writeStream = new Writable({write: jest.fn()})

            createReadStream.mockReturnValue(readStream)
            createWriteStream.mockReturnValue(writeStream)

            expect(ctx.listeners.message).toHaveLength(1)

            ctx.listeners.message[0]({
              filePath: '/foo/alpha/bravo.json',
              type: TRANSFORM_FILE,
            })

            readStream.destroy()

            setTimeout(() => {
              expect(mkdirp).toHaveBeenCalledTimes(1)
              expect(mkdirp).toHaveBeenCalledWith(
                '/bar/alpha',
                expect.any(Function),
              )
              expect(console.error).toHaveBeenCalledTimes(0)
              expect(process.send).toHaveBeenCalledTimes(1)
              expect(process.send).toHaveBeenCalledWith({
                erred: false,
                type: IDLE,
              })

              done()
            }, 1)
          })
        })
      })
    })
  })
}

describe('worker', () => {
  const ctx = {}

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    process.send = jest.fn()
  })

  afterAll(() => {
    console.error.mockRestore()
  })

  beforeEach(() => {
    console.error.mockReset()
    mkdirp.mockReset()
    process.send.mockReset()

    Object.assign(ctx, {
      listeners: [],
    })

    jest.spyOn(process, 'on').mockImplementation((type, callback) => {
      if (!Array.isArray(ctx.listeners[type])) {
        ctx.listeners[type] = []
      }

      ctx.listeners[type].push(callback)
    })
  })

  afterEach(() => {
    process.on.mockReset()
  })

  describe('when verbose', () => {
    tests(ctx, 'when output and source has trailing separator', {
      source: '/foo/',
      output: '/bar/',
      verbose: true,
    })

    tests(ctx, 'when output has trailing separator', {
      source: '/foo',
      output: '/bar/',
      verbose: true,
    })

    tests(ctx, 'when source has trailing separator', {
      source: '/foo/',
      output: '/bar',
      verbose: true,
    })

    tests(ctx, 'when neither output nor source has trailing separator', {
      source: '/foo',
      output: '/bar',
      verbose: true,
    })
  })

  describe('when not verbose', () => {
    tests(ctx, 'when output and source has trailing separator', {
      source: '/foo/',
      output: '/bar/',
      verbose: false,
    })

    tests(ctx, 'when output has trailing separator', {
      source: '/foo',
      output: '/bar/',
      verbose: false,
    })

    tests(ctx, 'when source has trailing separator', {
      source: '/foo/',
      output: '/bar',
      verbose: false,
    })

    tests(ctx, 'when neither output nor source has trailing separator', {
      source: '/foo',
      output: '/bar',
      verbose: false,
    })
  })
})
