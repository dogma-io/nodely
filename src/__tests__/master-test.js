jest.mock('cluster')
jest.mock('glob')
jest.mock('node-watch')
jest.mock('os')

import cluster from 'cluster'
import glob from 'glob'
import watch from 'node-watch'
import {cpus} from 'os'
import master from '../master'
import {IDLE, REMOVE_FILE, TRANSFORM_FILE} from '../actions'

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
      const source = argv.source.replace(/\/$/, '')
      const state = master(argv)

      expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
      expect(cluster.on).toHaveBeenCalledTimes(1)
      expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
      expect(console.info).toHaveBeenCalledTimes(1)
      expect(console.info).toHaveBeenCalledWith(
        `Spawned ${workerCount} workers`,
      )
      expect(glob).toHaveBeenCalledTimes(1)
      expect(glob).toHaveBeenCalledWith(`${source}/**/*`, expect.any(Function))
      expect(state).toEqual({
        erred: false,
        isWatching: argv.watch,
        queue: [],
        workers,
      })
      expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

      if (argv.watch) {
        expect(watch).toHaveBeenCalledWith(
          source,
          {recursive: true},
          expect.any(Function),
        )
      }

      state.workers.forEach(({worker}) => {
        expect(worker.on).toHaveBeenCalledTimes(1)
        expect(worker.on).toHaveBeenCalledWith('message', expect.any(Function))
      })

      expect(process.exit).not.toHaveBeenCalled()
    })

    it('replaces dead worker', () => {
      const source = argv.source.replace(/\/$/, '')
      const state = master(argv)

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

      expect(cluster.fork).toHaveBeenCalledTimes(workerCount + 1)
      expect(cluster.on).toHaveBeenCalledTimes(1)
      expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
      expect(console.info).toHaveBeenCalledTimes(2)
      expect(console.info).toHaveBeenCalledWith(
        `Spawned ${workerCount} workers`,
      )
      expect(console.info).toHaveBeenCalledWith(
        "Worker 1 died, spawning a new worker in it's place",
      )
      expect(glob).toHaveBeenCalledTimes(1)
      expect(glob).toHaveBeenCalledWith(`${source}/**/*`, expect.any(Function))
      expect(state).toEqual({
        erred: false,
        isWatching: argv.watch,
        queue: [],
        workers,
      })
      expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

      if (argv.watch) {
        expect(watch).toHaveBeenCalledWith(
          source,
          {recursive: true},
          expect.any(Function),
        )
      }

      state.workers.forEach(({worker}) => {
        expect(worker.on).toHaveBeenCalledTimes(1)
        expect(worker.on).toHaveBeenCalledWith('message', expect.any(Function))
      })

      expect(process.exit).not.toHaveBeenCalled()
    })

    it('functions as expected when glob fails', () => {
      const error = new Error('foo bar')

      glob.mockImplementation((path, callback) => {
        callback(error)
      })

      expect(() => {
        master(argv)
      }).toThrowError(error)
    })

    describe('when glob succeeds without files', () => {
      let state

      beforeEach(() => {
        glob.mockImplementation((path, callback) => {
          callback(null, [])
        })

        state = master(argv)
      })

      it('functions as expected', () => {
        const source = argv.source.replace(/\/$/, '')

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(2)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(console.info).toHaveBeenCalledWith(
          'Queuing up 0 files to be processed',
        )
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )
        expect(state).toEqual({
          erred: false,
          isWatching: argv.watch,
          queue: [],
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        if (argv.watch) {
          expect(watch).toHaveBeenCalledWith(
            source,
            {recursive: true},
            expect.any(Function),
          )
        }

        state.workers.forEach(({worker}) => {
          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )
        })

        if (!argv.watch) {
          expect(process.exit).toHaveBeenCalledTimes(1)
          expect(process.exit).toHaveBeenCalledWith(0)
        } else {
          expect(process.exit).not.toHaveBeenCalled()
        }
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

        state = master(argv)
      })

      it('functions as expected', () => {
        const source = argv.source.replace(/\/$/, '')

        workers[workers.length - 1].idle = false

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(2)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(console.info).toHaveBeenCalledWith(
          'Queuing up 4 files to be processed',
        )
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )

        const queue = []

        if (workerCount === 1) {
          queue.push({
            filePath: '/foo/baz.js',
            type: TRANSFORM_FILE,
          })
        }

        expect(state).toEqual({
          erred: false,
          isWatching: argv.watch,
          queue,
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        if (argv.watch) {
          expect(watch).toHaveBeenCalledWith(
            source,
            {recursive: true},
            expect.any(Function),
          )
        }

        const firstBusyWorkerIndex = state.workers.length - 2

        state.workers.forEach((workerInfo, index) => {
          const {worker} = workerInfo

          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )

          if (index >= firstBusyWorkerIndex) {
            expect(worker.send).toHaveBeenCalledTimes(1)
            expect(worker.send).toHaveBeenCalledWith({
              filePath: expect.any(String), // TODO: improve check
              type: TRANSFORM_FILE,
            })
          } else {
            expect(worker.send).not.toHaveBeenCalled()
          }
        })

        expect(process.exit).not.toHaveBeenCalled()
      })

      it('functions as expected when it receives non-object message from worker', () => {
        const source = argv.source.replace(/\/$/, '')

        state.workers[0].worker._trigger('message', 'foobar')

        workers[workers.length - 1].idle = false

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(2)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(console.info).toHaveBeenCalledWith(
          'Queuing up 4 files to be processed',
        )
        expect(console.error).toHaveBeenCalledTimes(1)
        expect(console.error).toHaveBeenCalledWith(
          'Expected message from worker to be an object but instead received type string',
        )
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )

        const queue = []

        if (workerCount === 1) {
          queue.push({
            filePath: '/foo/baz.js',
            type: TRANSFORM_FILE,
          })
        }

        expect(state).toEqual({
          erred: false,
          isWatching: argv.watch,
          queue,
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        if (argv.watch) {
          expect(watch).toHaveBeenCalledWith(
            source,
            {recursive: true},
            expect.any(Function),
          )
        }

        const firstBusyWorkerIndex = state.workers.length - 2

        state.workers.forEach((workerInfo, index) => {
          const {worker} = workerInfo

          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )

          if (index >= firstBusyWorkerIndex) {
            expect(worker.send).toHaveBeenCalledTimes(1)
            expect(worker.send).toHaveBeenCalledWith({
              filePath: expect.any(String), // TODO: improve check
              type: TRANSFORM_FILE,
            })
          } else {
            expect(worker.send).not.toHaveBeenCalled()
          }
        })

        expect(process.exit).not.toHaveBeenCalled()
      })

      it('functions as expected when it receives null message from worker', () => {
        const source = argv.source.replace(/\/$/, '')

        state.workers[0].worker._trigger('message', null)

        workers[workers.length - 1].idle = false

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(2)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(console.info).toHaveBeenCalledWith(
          'Queuing up 4 files to be processed',
        )
        expect(console.error).toHaveBeenCalledTimes(1)
        expect(console.error).toHaveBeenCalledWith(
          'Expected message from worker to be present but instead received null',
        )
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )

        const queue = []

        if (workerCount === 1) {
          queue.push({
            filePath: '/foo/baz.js',
            type: TRANSFORM_FILE,
          })
        }

        expect(state).toEqual({
          erred: false,
          isWatching: argv.watch,
          queue,
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        if (argv.watch) {
          expect(watch).toHaveBeenCalledWith(
            source,
            {recursive: true},
            expect.any(Function),
          )
        }

        const firstBusyWorkerIndex = state.workers.length - 2

        state.workers.forEach((workerInfo, index) => {
          const {worker} = workerInfo

          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )

          if (index >= firstBusyWorkerIndex) {
            expect(worker.send).toHaveBeenCalledTimes(1)
            expect(worker.send).toHaveBeenCalledWith({
              filePath: expect.any(String), // TODO: improve check
              type: TRANSFORM_FILE,
            })
          } else {
            expect(worker.send).not.toHaveBeenCalled()
          }
        })

        expect(process.exit).not.toHaveBeenCalled()
      })

      it('functions as expected when it receives message from worker of unkown action type', () => {
        const source = argv.source.replace(/\/$/, '')

        state.workers[0].worker._trigger('message', {type: 'FOOBAR'})

        workers[workers.length - 1].idle = false

        if (workers.length > 1) {
          workers[workers.length - 2].idle = false
        }

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(2)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(console.info).toHaveBeenCalledWith(
          'Queuing up 4 files to be processed',
        )
        expect(console.error).toHaveBeenCalledTimes(1)
        expect(console.error).toHaveBeenCalledWith(
          'Worker sent message with unknown action type FOOBAR',
        )
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )

        const queue = []

        if (workerCount === 1) {
          queue.push({
            filePath: '/foo/baz.js',
            type: TRANSFORM_FILE,
          })
        }

        expect(state).toEqual({
          erred: false,
          isWatching: argv.watch,
          queue,
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        if (argv.watch) {
          expect(watch).toHaveBeenCalledWith(
            source,
            {recursive: true},
            expect.any(Function),
          )
        }

        const firstBusyWorkerIndex = state.workers.length - 2

        state.workers.forEach((workerInfo, index) => {
          const {worker} = workerInfo

          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )

          if (index >= firstBusyWorkerIndex) {
            expect(worker.send).toHaveBeenCalledTimes(1)
            expect(worker.send).toHaveBeenCalledWith({
              filePath: expect.any(String), // TODO: improve check
              type: TRANSFORM_FILE,
            })
          } else {
            expect(worker.send).not.toHaveBeenCalled()
          }
        })

        expect(process.exit).not.toHaveBeenCalled()
      })

      it('functions as expected when it receives message from worker for idle action type (not erred)', () => {
        const source = argv.source.replace(/\/$/, '')

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

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(2)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(console.info).toHaveBeenCalledWith(
          'Queuing up 4 files to be processed',
        )
        expect(console.error).toHaveBeenCalledTimes(0)
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )

        expect(state).toEqual({
          erred: false,
          isWatching: argv.watch,
          queue: [],
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        if (argv.watch) {
          expect(watch).toHaveBeenCalledWith(
            source,
            {recursive: true},
            expect.any(Function),
          )
        }

        const firstBusyWorkerIndex = state.workers.length - 2

        state.workers.forEach((workerInfo, index) => {
          const {worker} = workerInfo

          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )

          if (index >= firstBusyWorkerIndex) {
            expect(worker.send).toHaveBeenCalledTimes(workerCount === 1 ? 2 : 1)
            expect(worker.send).toHaveBeenCalledWith({
              filePath: expect.any(String), // TODO: improve check
              type: TRANSFORM_FILE,
            })
          } else {
            expect(worker.send).not.toHaveBeenCalled()
          }
        })

        expect(process.exit).not.toHaveBeenCalled()
      })

      it('functions as expected when it receives message from worker for idle action type (erred)', () => {
        const source = argv.source.replace(/\/$/, '')

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

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(2)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(console.info).toHaveBeenCalledWith(
          'Queuing up 4 files to be processed',
        )
        expect(console.error).toHaveBeenCalledTimes(0)
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )

        expect(state).toEqual({
          erred: true,
          isWatching: argv.watch,
          queue: [],
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        if (argv.watch) {
          expect(watch).toHaveBeenCalledWith(
            source,
            {recursive: true},
            expect.any(Function),
          )
        }

        const firstBusyWorkerIndex = state.workers.length - 2

        state.workers.forEach((workerInfo, index) => {
          const {worker} = workerInfo

          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )

          if (index >= firstBusyWorkerIndex) {
            expect(worker.send).toHaveBeenCalledTimes(workerCount === 1 ? 2 : 1)
            expect(worker.send).toHaveBeenCalledWith({
              filePath: expect.any(String), // TODO: improve check
              type: TRANSFORM_FILE,
            })
          } else {
            expect(worker.send).not.toHaveBeenCalled()
          }
        })

        expect(process.exit).not.toHaveBeenCalled()
      })

      if (!argv.watch) {
        it('functions as expected once all files have been processed (not erred)', () => {
          const source = argv.source.replace(/\/$/, '')

          state.erred = false
          state.queue = []
          state.workers.forEach(workerInfo => {
            workerInfo.idle = true
          })

          state.workers[state.workers.length - 1].worker._trigger('message', {
            erred: false,
            type: IDLE,
          })

          expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
          expect(cluster.on).toHaveBeenCalledTimes(1)
          expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
          expect(console.info).toHaveBeenCalledTimes(2)
          expect(console.info).toHaveBeenCalledWith(
            `Spawned ${workerCount} workers`,
          )
          expect(console.info).toHaveBeenCalledWith(
            'Queuing up 4 files to be processed',
          )
          expect(console.error).toHaveBeenCalledTimes(0)
          expect(glob).toHaveBeenCalledTimes(1)
          expect(glob).toHaveBeenCalledWith(
            `${source}/**/*`,
            expect.any(Function),
          )

          expect(state).toEqual({
            erred: false,
            isWatching: argv.watch,
            queue: [],
            workers,
          })
          expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

          if (argv.watch) {
            expect(watch).toHaveBeenCalledWith(
              source,
              {recursive: true},
              expect.any(Function),
            )
          }

          const firstBusyWorkerIndex = state.workers.length - 2

          state.workers.forEach((workerInfo, index) => {
            const {worker} = workerInfo

            expect(worker.on).toHaveBeenCalledTimes(1)
            expect(worker.on).toHaveBeenCalledWith(
              'message',
              expect.any(Function),
            )

            if (index >= firstBusyWorkerIndex) {
              expect(worker.send).toHaveBeenCalledTimes(1)
              expect(worker.send).toHaveBeenCalledWith({
                filePath: expect.any(String), // TODO: improve check
                type: TRANSFORM_FILE,
              })
            } else {
              expect(worker.send).not.toHaveBeenCalled()
            }
          })

          expect(process.exit).toHaveBeenCalledTimes(1)
          expect(process.exit).toHaveBeenCalledWith(0)
        })

        it('functions as expected once all files have been processed (erred)', () => {
          const source = argv.source.replace(/\/$/, '')

          state.erred = true
          state.queue = []
          state.workers.forEach(workerInfo => {
            workerInfo.idle = true
          })

          state.workers[state.workers.length - 1].worker._trigger('message', {
            erred: true,
            type: IDLE,
          })

          expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
          expect(cluster.on).toHaveBeenCalledTimes(1)
          expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
          expect(console.info).toHaveBeenCalledTimes(2)
          expect(console.info).toHaveBeenCalledWith(
            `Spawned ${workerCount} workers`,
          )
          expect(console.info).toHaveBeenCalledWith(
            'Queuing up 4 files to be processed',
          )
          expect(console.error).toHaveBeenCalledTimes(0)
          expect(glob).toHaveBeenCalledTimes(1)
          expect(glob).toHaveBeenCalledWith(
            `${source}/**/*`,
            expect.any(Function),
          )

          expect(state).toEqual({
            erred: true,
            isWatching: argv.watch,
            queue: [],
            workers,
          })
          expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

          if (argv.watch) {
            expect(watch).toHaveBeenCalledWith(
              source,
              {recursive: true},
              expect.any(Function),
            )
          }

          const firstBusyWorkerIndex = state.workers.length - 2

          state.workers.forEach((workerInfo, index) => {
            const {worker} = workerInfo

            expect(worker.on).toHaveBeenCalledTimes(1)
            expect(worker.on).toHaveBeenCalledWith(
              'message',
              expect.any(Function),
            )

            if (index >= firstBusyWorkerIndex) {
              expect(worker.send).toHaveBeenCalledTimes(1)
              expect(worker.send).toHaveBeenCalledWith({
                filePath: expect.any(String), // TODO: improve check
                type: TRANSFORM_FILE,
              })
            } else {
              expect(worker.send).not.toHaveBeenCalled()
            }
          })

          expect(process.exit).toHaveBeenCalledTimes(1)
          expect(process.exit).toHaveBeenCalledWith(1)
        })
      }
    })

    if (argv.watch) {
      it('functions as expected when a file was updated', () => {
        const source = argv.source.replace(/\/$/, '')

        watch.mockImplementation((...args) => {
          const handler = args[args.length - 1]
          handler('update', '/foo/alpha.js')
        })

        workers[workers.length - 1].idle = false

        const state = master(argv)

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(1)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )
        expect(state).toEqual({
          erred: false,
          isWatching: argv.watch,
          queue: [],
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        expect(watch).toHaveBeenCalledWith(
          source,
          {recursive: true},
          expect.any(Function),
        )
        const firstBusyWorkerIndex = state.workers.length - 1

        state.workers.forEach((workerInfo, index) => {
          const {worker} = workerInfo

          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )

          if (index >= firstBusyWorkerIndex) {
            expect(worker.send).toHaveBeenCalledTimes(1)
            expect(worker.send).toHaveBeenCalledWith({
              filePath: '/foo/alpha.js',
              type: TRANSFORM_FILE,
            })
          } else {
            expect(worker.send).not.toHaveBeenCalled()
          }
        })
      })

      it('functions as expected when a file was removed', () => {
        const source = argv.source.replace(/\/$/, '')

        watch.mockImplementation((...args) => {
          const handler = args[args.length - 1]
          handler('remove', '/foo/alpha.js')
        })

        workers[workers.length - 1].idle = false

        const state = master(argv)

        expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
        expect(cluster.on).toHaveBeenCalledTimes(1)
        expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
        expect(console.info).toHaveBeenCalledTimes(1)
        expect(console.info).toHaveBeenCalledWith(
          `Spawned ${workerCount} workers`,
        )
        expect(glob).toHaveBeenCalledTimes(1)
        expect(glob).toHaveBeenCalledWith(
          `${source}/**/*`,
          expect.any(Function),
        )
        expect(state).toEqual({
          erred: false,
          isWatching: argv.watch,
          queue: [],
          workers,
        })
        expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

        expect(watch).toHaveBeenCalledWith(
          source,
          {recursive: true},
          expect.any(Function),
        )
        const firstBusyWorkerIndex = state.workers.length - 1

        state.workers.forEach((workerInfo, index) => {
          const {worker} = workerInfo

          expect(worker.on).toHaveBeenCalledTimes(1)
          expect(worker.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function),
          )

          if (index >= firstBusyWorkerIndex) {
            expect(worker.send).toHaveBeenCalledTimes(1)
            expect(worker.send).toHaveBeenCalledWith({
              filePath: '/foo/alpha.js',
              type: REMOVE_FILE,
            })
          } else {
            expect(worker.send).not.toHaveBeenCalled()
          }
        })
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
      master({})
    }).toThrowError('workerCount is expected to be a number not undefined')
  })

  it('throws an error when worker count argument is not a number', () => {
    expect(() => {
      master({workerCount: 'foo'})
    }).toThrowError('workerCount is expected to be a number not string')
  })

  describe('when source has trailing separator', () => {
    describe('when watch mode enabled', () => {
      tests('when worker count argument is zero', {
        argv: {
          source: '/foo/',
          watch: true,
          workerCount: 0,
        },
      })

      tests('when worker count is one', {
        argv: {
          source: '/foo/',
          watch: true,
          workerCount: 1,
        },
      })

      tests('when worker count is two', {
        argv: {
          source: '/foo/',
          watch: true,
          workerCount: 2,
        },
      })
    })

    describe('when watch mode disabled', () => {
      tests('when worker count argument is zero', {
        argv: {
          source: '/foo/',
          watch: false,
          workerCount: 0,
        },
      })

      tests('when worker count is one', {
        argv: {
          source: '/foo/',
          watch: false,
          workerCount: 1,
        },
      })

      tests('when worker count is two', {
        argv: {
          source: '/foo/',
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
          watch: true,
          workerCount: 0,
        },
      })

      tests('when worker count is one', {
        argv: {
          source: '/foo',
          watch: true,
          workerCount: 1,
        },
      })

      tests('when worker count is two', {
        argv: {
          source: '/foo',
          watch: true,
          workerCount: 2,
        },
      })
    })

    describe('when watch mode disabled', () => {
      tests('when worker count argument is zero', {
        argv: {
          source: '/foo',
          watch: false,
          workerCount: 0,
        },
      })

      tests('when worker count is one', {
        argv: {
          source: '/foo',
          watch: false,
          workerCount: 1,
        },
      })

      tests('when worker count is two', {
        argv: {
          source: '/foo',
          watch: false,
          workerCount: 2,
        },
      })
    })
  })
})
