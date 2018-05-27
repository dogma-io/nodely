jest.mock('cluster')
jest.mock('glob')
jest.mock('node-watch')
jest.mock('os')

import cluster from 'cluster'
import glob from 'glob'
import watch from 'node-watch'
import {cpus} from 'os'
import {master} from '../master'
import {IDLE, TRANSFORM_FILE} from '../actions'

function expectSnapshot(state) {
  expect({
    clusterFork: cluster.fork,
    clusterOn: cluster.on,
    consoleError: console.error,
    consoleInfo: console.info,
    glob,
    processExit: process.exit,
    state,
    watch,
  }).toMatchSnapshot()
}

function tests(description, {argv}) {
  describe(description, () => {
    let clusterListeners, workerCount, workers

    beforeEach(() => {
      clusterListeners = {}
      workerCount = argv.workerCount < 1 ? cpus().length - 1 : argv.workerCount
      workers = []

      for (let id = 1; id <= workerCount; id++) {
        workers.push({
          idle: true,
          worker: expect.objectContaining({
            id,
            on: expect.any(Function),
            send: expect.any(Function),
          }),
        })
      }

      cluster.on.mockImplementation((type, callback) => {
        if (!Array.isArray(clusterListeners[type])) {
          clusterListeners[type] = []
        }

        clusterListeners[type].push(callback)
      })
    })

    it('functions as expected', () => {
      const state = master(argv, cluster.fork, cluster.on)
      expectSnapshot(state)
    })

    it('replaces dead worker', () => {
      const state = master(argv, cluster.fork, cluster.on)

      clusterListeners.exit.forEach(callback => {
        callback(state.workers[0].worker)
      })

      workers.splice(0, 1)
      workers.push({
        idle: true,
        worker: expect.objectContaining({
          id: workerCount + 1,
          on: expect.any(Function),
          send: expect.any(Function),
        }),
      })

      expectSnapshot(state)
    })

    it('functions as expected when glob fails', () => {
      const error = new Error('foo bar')

      glob.mockImplementation((path, callback) => {
        callback(error)
      })

      expect(() => {
        master(argv, cluster.fork, cluster.on)
      }).toThrowError(error)
    })

    describe('when glob succeeds without files', () => {
      let state

      beforeEach(() => {
        glob.mockImplementation((path, callback) => {
          callback(null, [])
        })

        state = master(argv, cluster.fork, cluster.on)
      })

      it('functions as expected', () => {
        expectSnapshot(state)
      })
    })

    describe('when glob succeeds with files', () => {
      let state

      beforeEach(() => {
        glob.mockImplementation((path, callback) => {
          callback(null, [
            '/foo/__mocks__/bar.js',
            '/foo/__tests__/bar-test.js',
            '/foo/bar.js',
            '/foo/baz.js',
          ])
        })

        state = master(argv, cluster.fork, cluster.on)
      })

      it('functions as expected', () => {
        workers[workers.length - 1].idle = false

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        const queue = []

        if (workerCount === 1) {
          queue.push({
            filePath: '/foo/baz.js',
            type: TRANSFORM_FILE,
          })
        }

        expectSnapshot(state)
      })

      it('functions as expected when it receives non-object message from worker', () => {
        state.workers[0].worker._trigger('message', 'foobar')

        workers[workers.length - 1].idle = false

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        const queue = []

        if (workerCount === 1) {
          queue.push({
            filePath: '/foo/baz.js',
            type: TRANSFORM_FILE,
          })
        }

        expectSnapshot(state)
      })

      it('functions as expected when it receives null message from worker', () => {
        state.workers[0].worker._trigger('message', null)

        workers[workers.length - 1].idle = false

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        const queue = []

        if (workerCount === 1) {
          queue.push({
            filePath: '/foo/baz.js',
            type: TRANSFORM_FILE,
          })
        }

        expectSnapshot(state)
      })

      it('functions as expected when it receives message from worker of unkown action type', () => {
        state.workers[0].worker._trigger('message', {type: 'FOOBAR'})

        workers[workers.length - 1].idle = false

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        const queue = []

        if (workerCount === 1) {
          queue.push({
            filePath: '/foo/baz.js',
            type: TRANSFORM_FILE,
          })
        }

        expectSnapshot(state)
      })

      it('functions as expected when it receives message from worker for idle action type (not erred)', () => {
        state.workers[state.workers.length - 1].worker._trigger('message', {
          erred: false,
          type: IDLE,
        })

        if (workerCount === 1) {
          workers[0].idle = false
        }

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        expectSnapshot(state)
      })

      it('functions as expected when it receives message from worker for idle action type (erred)', () => {
        state.workers[state.workers.length - 1].worker._trigger('message', {
          erred: true,
          type: IDLE,
        })

        if (workerCount === 1) {
          workers[0].idle = false
        }

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        expectSnapshot(state)
      })

      if (!argv.watch) {
        it('functions as expected once all files have been processed (not erred)', () => {
          state.erred = false
          state.queue = []
          state.workers.forEach(workerInfo => {
            workerInfo.idle = true
          })

          state.workers[state.workers.length - 1].worker._trigger('message', {
            erred: false,
            type: IDLE,
          })

          expectSnapshot(state)
        })

        it('functions as expected once all files have been processed (erred)', () => {
          state.erred = true
          state.queue = []
          state.workers.forEach(workerInfo => {
            workerInfo.idle = true
          })

          state.workers[state.workers.length - 1].worker._trigger('message', {
            erred: true,
            type: IDLE,
          })

          expectSnapshot(state)
        })
      }
    })

    if (argv.watch) {
      it('functions as expected when a file was updated', () => {
        watch.mockImplementation((...args) => {
          const handler = args[args.length - 1]
          handler('update', '/foo/alpha.js')
        })

        workers[workers.length - 1].idle = false

        const state = master(argv, cluster.fork, cluster.on)

        expectSnapshot(state)
      })

      it('functions as expected when a file was removed', () => {
        watch.mockImplementation((...args) => {
          const handler = args[args.length - 1]
          handler('remove', '/foo/alpha.js')
        })

        workers[workers.length - 1].idle = false

        const state = master(argv, cluster.fork, cluster.on)

        expectSnapshot(state)
      })
    }
  })
}

describe('master', () => {
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'info').mockImplementation(() => {})
    jest.spyOn(process, 'exit').mockImplementation(() => {})
  })

  afterAll(() => {
    console.error.mockRestore()
    console.info.mockRestore()
    process.exit.mockRestore()
  })

  beforeEach(() => {
    let nextWorkerId = 1

    cluster.fork.mockReset().mockImplementation(() => {
      const listeners = {}

      const worker = {
        _trigger(type, ...args) {
          listeners[type].forEach(callback => {
            callback(...args) // eslint-disable-line
          })
        },
        id: nextWorkerId++,
        send: jest.fn(),
      }

      return Object.assign(worker, {
        on: jest.fn((type, callback) => {
          if (!Array.isArray(listeners[type])) {
            listeners[type] = []
          }

          listeners[type].push(callback)
        }),
      })
    })

    cluster.on.mockReset()
    console.error.mockReset()
    console.info.mockReset()

    cpus.mockReturnValue({
      length: 8,
    })

    glob.mockReset()
    process.exit.mockReset()
    watch.mockReset()
  })

  it('throws an error when worker count argument is missng', () => {
    expect(() => {
      master({}, cluster.fork, cluster.on)
    }).toThrowError('workerCount is expected to be a number not undefined')
  })

  it('throws an error when worker count argument is not a number', () => {
    expect(() => {
      master({workerCount: 'foo'}, cluster.fork, cluster.on)
    }).toThrowError('workerCount is expected to be a number not string')
  })

  describe('when verbose', () => {
    describe('when source has trailing separator', () => {
      describe('when watch mode enabled', () => {
        tests('when worker count argument is zero', {
          argv: {
            source: '/foo/',
            verbose: true,
            watch: true,
            workerCount: 0,
          },
        })

        tests('when worker count is one', {
          argv: {
            source: '/foo/',
            verbose: true,
            watch: true,
            workerCount: 1,
          },
        })

        tests('when worker count is two', {
          argv: {
            source: '/foo/',
            verbose: true,
            watch: true,
            workerCount: 2,
          },
        })
      })

      describe('when watch mode disabled', () => {
        tests('when worker count argument is zero', {
          argv: {
            source: '/foo/',
            verbose: true,
            watch: false,
            workerCount: 0,
          },
        })

        tests('when worker count is one', {
          argv: {
            source: '/foo/',
            verbose: true,
            watch: false,
            workerCount: 1,
          },
        })

        tests('when worker count is two', {
          argv: {
            source: '/foo/',
            verbose: true,
            watch: false,
            workerCount: 2,
          },
        })
      })
    })

    describe('when source does not have trailing separator', () => {
      describe('when watch mode enabled', () => {
        tests('when worker count argument is zero', {
          argv: {
            source: '/foo',
            verbose: true,
            watch: true,
            workerCount: 0,
          },
        })

        tests('when worker count is one', {
          argv: {
            source: '/foo',
            verbose: true,
            watch: true,
            workerCount: 1,
          },
        })

        tests('when worker count is two', {
          argv: {
            source: '/foo',
            verbose: true,
            watch: true,
            workerCount: 2,
          },
        })
      })

      describe('when watch mode disabled', () => {
        tests('when worker count argument is zero', {
          argv: {
            source: '/foo',
            verbose: true,
            watch: false,
            workerCount: 0,
          },
        })

        tests('when worker count is one', {
          argv: {
            source: '/foo',
            verbose: true,
            watch: false,
            workerCount: 1,
          },
        })

        tests('when worker count is two', {
          argv: {
            source: '/foo',
            verbose: true,
            watch: false,
            workerCount: 2,
          },
        })
      })
    })
  })

  describe('when not verbose', () => {
    describe('when source has trailing separator', () => {
      describe('when watch mode enabled', () => {
        tests('when worker count argument is zero', {
          argv: {
            source: '/foo/',
            verbose: false,
            watch: true,
            workerCount: 0,
          },
        })

        tests('when worker count is one', {
          argv: {
            source: '/foo/',
            verbose: false,
            watch: true,
            workerCount: 1,
          },
        })

        tests('when worker count is two', {
          argv: {
            source: '/foo/',
            verbose: false,
            watch: true,
            workerCount: 2,
          },
        })
      })

      describe('when watch mode disabled', () => {
        tests('when worker count argument is zero', {
          argv: {
            source: '/foo/',
            verbose: false,
            watch: false,
            workerCount: 0,
          },
        })

        tests('when worker count is one', {
          argv: {
            source: '/foo/',
            verbose: false,
            watch: false,
            workerCount: 1,
          },
        })

        tests('when worker count is two', {
          argv: {
            source: '/foo/',
            verbose: false,
            watch: false,
            workerCount: 2,
          },
        })
      })
    })

    describe('when source does not have trailing separator', () => {
      describe('when watch mode enabled', () => {
        tests('when worker count argument is zero', {
          argv: {
            source: '/foo',
            verbose: false,
            watch: true,
            workerCount: 0,
          },
        })

        tests('when worker count is one', {
          argv: {
            source: '/foo',
            verbose: false,
            watch: true,
            workerCount: 1,
          },
        })

        tests('when worker count is two', {
          argv: {
            source: '/foo',
            verbose: false,
            watch: true,
            workerCount: 2,
          },
        })
      })

      describe('when watch mode disabled', () => {
        tests('when worker count argument is zero', {
          argv: {
            source: '/foo',
            verbose: false,
            watch: false,
            workerCount: 0,
          },
        })

        tests('when worker count is one', {
          argv: {
            source: '/foo',
            verbose: false,
            watch: false,
            workerCount: 1,
          },
        })

        tests('when worker count is two', {
          argv: {
            source: '/foo',
            verbose: false,
            watch: false,
            workerCount: 2,
          },
        })
      })
    })
  })
})
