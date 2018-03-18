jest.mock('@babel/core')
jest.mock('fs')
jest.mock('mkdirp')

import {transform} from '@babel/core'
import {
  createReadStream,
  createWriteStream,
  readdir,
  readFile,
  stat,
  unlink,
  writeFile,
} from 'fs'
import mkdirp from 'mkdirp'
import {Readable, Writable} from 'stream'
import {REMOVE_FILE, TRANSFORM_FILE} from '../actions'
import worker from '../worker'

const TRANSFORM_OPTIONS = Object.freeze({
  presets: [
    [
      '@babel/env',
      {
        targets: {
          node: '6', // LTS
        },
      },
    ],
    '@babel/flow',
    '@babel/react',
  ],
})

function expectSnapshot() {
  expect({
    consoleError: console.error,
    createReadStream,
    createWriteStream,
    mkdirp,
    processOn: process.on,
    processSend: process.send,
    readFile,
    transform,
    writeFile,
  }).toMatchSnapshot()
}

function configTests(ctx, description, argv, init) {
  describe(description, () => {
    describe('when include argument not set', () => {
      beforeEach(() => {
        init()
        return worker(argv, process.on, process.send)
      })

      it('functions as expected', () => {
        expectSnapshot()
      })

      it('functions as expected when master sends non-object message', () => {
        expect(ctx.listeners.message).toHaveLength(1)
        ctx.listeners.message[0]('test')
        expectSnapshot()
      })

      it('functions as expected when master sends null message', () => {
        expect(ctx.listeners.message).toHaveLength(1)
        ctx.listeners.message[0](null)
        expectSnapshot()
      })

      it('functions as expected when master sends message with unknown action type', () => {
        expect(ctx.listeners.message).toHaveLength(1)
        ctx.listeners.message[0]({type: 'FOO_BAR'})
        expectSnapshot()
      })

      describe('when master sends message to remove file', () => {
        it('functions as expected when fails to remove file', () => {
          const error = new Error('foo bar')

          unlink.mockImplementation((...args) => {
            const callback = args[args.length - 1]
            callback(error)
          })

          expect(ctx.listeners.message).toHaveLength(1)

          ctx.listeners.message[0]({
            filePath: '/foo/alpha/bravo.js',
            type: REMOVE_FILE,
          })

          expectSnapshot()
        })

        it('functions as expected when successfully removes file', () => {
          unlink.mockImplementation((...args) => {
            const callback = args[args.length - 1]
            callback(null)
          })

          expect(ctx.listeners.message).toHaveLength(1)

          ctx.listeners.message[0]({
            filePath: '/foo/alpha/bravo.js',
            type: REMOVE_FILE,
          })

          expectSnapshot()
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
            expectSnapshot()
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
              expectSnapshot()
              done()
            })
          })

          describe('when file is a Javascript file', () => {
            it('functions as expected when it fails to read source file', done => {
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
                expectSnapshot()
                done()
              }, 1)
            })

            describe('when it successfully reads source file', () => {
              let contents

              beforeEach(() => {
                contents = 'blah blah blah'

                readFile.mockImplementation((...args) => {
                  const callback = args[args.length - 1]
                  callback(null, contents)
                })
              })

              describe('when it fails to get stats for file', () => {
                beforeEach(() => {
                  stat.mockImplementation((...args) => {
                    const callback = args[args.length - 1]
                    const error = new Error('foo bar')
                    callback(error)
                  })
                })

                it('functions as expected when it fails to transform file contents', done => {
                  const error = new Error('foo bar')

                  transform.mockImplementation((code, options, cb) => {
                    cb(error)
                  })

                  expect(ctx.listeners.message).toHaveLength(1)

                  ctx.listeners.message[0]({
                    filePath: '/foo/alpha/bravo.js',
                    type: TRANSFORM_FILE,
                  })

                  setTimeout(() => {
                    expectSnapshot()
                    done()
                  }, 1)
                })

                describe('when it succssfully transforms file contents', () => {
                  beforeEach(() => {
                    transform.mockImplementation((code, options, cb) => {
                      cb(null, {code})
                    })
                  })

                  it('functions as expected when it fails to write transformed contents to file', done => {
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
                      expectSnapshot()
                      done()
                    }, 1)
                  })

                  it('functions as expected when it successfully writes transformed contents to file', done => {
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
                      expectSnapshot()
                      done()
                    }, 1)
                  })
                })
              })

              describe('when it successfully gets stats for file', () => {
                beforeEach(() => {
                  stat.mockImplementation((...args) => {
                    const callback = args[args.length - 1]
                    callback(null, {mode: 0o666})
                  })
                })

                it('functions as expected when it fails to transform file contents', done => {
                  const error = new Error('foo bar')

                  transform.mockImplementation((code, options, cb) => {
                    cb(error)
                  })

                  expect(ctx.listeners.message).toHaveLength(1)

                  ctx.listeners.message[0]({
                    filePath: '/foo/alpha/bravo.js',
                    type: TRANSFORM_FILE,
                  })

                  setTimeout(() => {
                    expectSnapshot()
                    done()
                  }, 1)
                })

                describe('when it succssfully transforms file contents', () => {
                  beforeEach(() => {
                    transform.mockImplementation((code, options, cb) => {
                      cb(null, {code})
                    })
                  })

                  it('functions as expected when it fails to write transformed contents to file', done => {
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
                      expectSnapshot()
                      done()
                    }, 1)
                  })

                  it('functions as expected when it successfully writes transformed contents to file', done => {
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
                      expectSnapshot()
                      done()
                    }, 1)
                  })
                })
              })
            })
          })

          describe('when file is not a Javascript file', () => {
            describe('when it fails to get stats for file', () => {
              beforeEach(() => {
                stat.mockImplementation((...args) => {
                  const callback = args[args.length - 1]
                  const error = new Error('foo bar')
                  callback(error)
                })
              })

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
                  expectSnapshot()
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
                  expectSnapshot()
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
                    expectSnapshot()
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
                    expectSnapshot()
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
                  expectSnapshot()
                  done()
                }, 1)
              })
            })

            describe('when it successfully gets stats for file', () => {
              beforeEach(() => {
                stat.mockImplementation((...args) => {
                  const callback = args[args.length - 1]
                  callback(null, {mode: 0o666})
                })
              })

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
                  expectSnapshot()
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
                  expectSnapshot()
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
                    expectSnapshot()
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
                    expectSnapshot()
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
                  expectSnapshot()
                  done()
                }, 1)
              })
            })
          })
        })
      })
    })

    it('should function as expected when include argument is invalid regex', () => {
      init()
      return worker(
        Object.assign({include: '('}, argv),
        process.on,
        process.send,
      ).catch(err => {
        expect(err).toEqual(new Error('Include option is an invalid regex.'))
      })
    })

    describe('when include argument allows Javascript and JSON', () => {
      beforeEach(() => {
        init()
        // eslint-disable-next-line
        return worker(Object.assign({include: '\.js(on)?$'}, argv), process.on, process.send)
      })

      describe('when master sends message to transform file', () => {
        it('should skip CSS files', done => {
          expect(ctx.listeners.message).toHaveLength(1)

          ctx.listeners.message[0]({
            filePath: '/foo/alpha/bravo.css',
            type: TRANSFORM_FILE,
          })

          setTimeout(() => {
            expectSnapshot()
            done()
          }, 1)
        })

        describe('when it successfully creates directory for file', () => {
          beforeEach(() => {
            mkdirp.mockImplementation((...args) => {
              const callback = args[args.length - 1]
              callback(null)
            })
          })

          describe('when file is a Javascript file', () => {
            it('functions as expected when it fails to read source file', done => {
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
                expectSnapshot()
                done()
              }, 1)
            })

            describe('when it successfully reads source file', () => {
              let contents

              beforeEach(() => {
                contents = 'blah blah blah'

                readFile.mockImplementation((...args) => {
                  const callback = args[args.length - 1]
                  callback(null, contents)
                })
              })

              describe('when it fails to get stats for file', () => {
                beforeEach(() => {
                  stat.mockImplementation((...args) => {
                    const callback = args[args.length - 1]
                    const error = new Error('foo bar')
                    callback(error)
                  })
                })

                it('functions as expected when it fails to transform file contents', done => {
                  const error = new Error('foo bar')

                  transform.mockImplementation((code, options, cb) => {
                    cb(error)
                  })

                  expect(ctx.listeners.message).toHaveLength(1)

                  ctx.listeners.message[0]({
                    filePath: '/foo/alpha/bravo.js',
                    type: TRANSFORM_FILE,
                  })

                  setTimeout(() => {
                    expectSnapshot()
                    done()
                  }, 1)
                })

                describe('when it succssfully transforms file contents', () => {
                  beforeEach(() => {
                    transform.mockImplementation((code, options, cb) => {
                      cb(null, {code})
                    })
                  })

                  it('functions as expected when it fails to write transformed contents to file', done => {
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
                      expectSnapshot()
                      done()
                    }, 1)
                  })

                  it('functions as expected when it successfully writes transformed contents to file', done => {
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
                      expectSnapshot()
                      done()
                    }, 1)
                  })
                })
              })

              describe('when it successfully gets stats for file', () => {
                beforeEach(() => {
                  stat.mockImplementation((...args) => {
                    const callback = args[args.length - 1]
                    callback(null, {mode: 0o666})
                  })
                })

                it('functions as expected when it fails to transform file contents', done => {
                  const error = new Error('foo bar')

                  transform.mockImplementation((code, options, cb) => {
                    cb(error)
                  })

                  expect(ctx.listeners.message).toHaveLength(1)

                  ctx.listeners.message[0]({
                    filePath: '/foo/alpha/bravo.js',
                    type: TRANSFORM_FILE,
                  })

                  setTimeout(() => {
                    expectSnapshot()
                    done()
                  }, 1)
                })

                describe('when it succssfully transforms file contents', () => {
                  beforeEach(() => {
                    transform.mockImplementation((code, options, cb) => {
                      cb(null, {code})
                    })
                  })

                  it('functions as expected when it fails to write transformed contents to file', done => {
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
                      expectSnapshot()
                      done()
                    }, 1)
                  })

                  it('functions as expected when it successfully writes transformed contents to file', done => {
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
                      expectSnapshot()
                      done()
                    }, 1)
                  })
                })
              })
            })
          })

          describe('when file is a JSON file', () => {
            describe('when it fails to get stats for file', () => {
              beforeEach(() => {
                stat.mockImplementation((...args) => {
                  const callback = args[args.length - 1]
                  const error = new Error('foo bar')
                  callback(error)
                })
              })

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
                  expectSnapshot()
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
                  expectSnapshot()
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
                    expectSnapshot()
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
                    expectSnapshot()
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
                  expectSnapshot()
                  done()
                }, 1)
              })
            })

            describe('when it successfully gets stats for file', () => {
              beforeEach(() => {
                stat.mockImplementation((...args) => {
                  const callback = args[args.length - 1]
                  callback(null, {mode: 0o666})
                })
              })

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
                  expectSnapshot()
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
                  expectSnapshot()
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
                    expectSnapshot()
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
                    expectSnapshot()
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
                  expectSnapshot()
                  done()
                }, 1)
              })
            })
          })
        })
      })
    })
  })
}

function tests(ctx, description, argv) {
  describe(description, () => {
    configTests(
      ctx,
      'when fails to read files to look for Babel config',
      argv,
      () => {
        readdir.mockImplementation((...args) => {
          args[args.length - 1](new Error('foo bar'))
        })
      },
    )

    configTests(ctx, 'when no Babel config', argv, () => {
      readdir.mockImplementation((...args) => {
        args[args.length - 1](null, [])
      })
    })

    configTests(ctx, 'when Javascript Babel config', argv, () => {
      readdir.mockImplementation((...args) => {
        args[args.length - 1](null, ['.babelrc.js'])
      })
    })

    describe('when JSON Babel config is invalid JSON', () => {
      beforeEach(() => {
        readdir.mockImplementation((...args) => {
          args[args.length - 1](null, ['.babelrc.json'])
        })

        readFile.mockImplementationOnce((...args) => {
          args[args.length - 1](null, '{')
        })

        return worker(argv, process.on, process.send)
      })

      it('should function as expected', () => {
        expectSnapshot()
      })
    })

    describe('when fails to read JSON Babel config', () => {
      beforeEach(() => {
        readdir.mockImplementation((...args) => {
          args[args.length - 1](null, ['.babelrc.json'])
        })

        readFile.mockImplementationOnce((...args) => {
          args[args.length - 1](new Error('foo bar'))
        })

        return worker(argv, process.on, process.send)
      })

      it('should function as expected', () => {
        expectSnapshot()
      })
    })

    configTests(ctx, 'when JSON Babel config', argv, () => {
      readdir.mockImplementation((...args) => {
        args[args.length - 1](null, ['.babelrc.json'])
      })
      readFile.mockImplementationOnce((...args) => {
        args[args.length - 1](null, JSON.stringify(TRANSFORM_OPTIONS))
      })
    })
  })
}

describe('worker', () => {
  const ctx = {}

  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterAll(() => {
    console.error.mockRestore()
  })

  beforeEach(() => {
    ;[
      console.error,
      createReadStream,
      createWriteStream,
      mkdirp,
      readdir,
      readFile,
      stat,
      transform,
      unlink,
      writeFile,
    ].forEach(e => {
      e.mockReset()
    })

    process.send = jest.fn()

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
      target: '6',
      verbose: true,
    })

    tests(ctx, 'when output has trailing separator', {
      source: '/foo',
      output: '/bar/',
      target: '6',
      verbose: true,
    })

    tests(ctx, 'when source has trailing separator', {
      source: '/foo/',
      output: '/bar',
      target: '6',
      verbose: true,
    })

    tests(ctx, 'when neither output nor source has trailing separator', {
      source: '/foo',
      output: '/bar',
      target: '6',
      verbose: true,
    })
  })

  describe('when not verbose', () => {
    tests(ctx, 'when output and source has trailing separator', {
      source: '/foo/',
      output: '/bar/',
      target: '6',
      verbose: false,
    })

    tests(ctx, 'when output has trailing separator', {
      source: '/foo',
      output: '/bar/',
      target: '6',
      verbose: false,
    })

    tests(ctx, 'when source has trailing separator', {
      source: '/foo/',
      output: '/bar',
      target: '6',
      verbose: false,
    })

    tests(ctx, 'when neither output nor source has trailing separator', {
      source: '/foo',
      output: '/bar',
      target: '6',
      verbose: false,
    })
  })
})
