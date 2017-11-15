jest.mock('cluster')
jest.mock('glob')
jest.mock('node-watch')
jest.mock('os')

import cluster from 'cluster'
import glob from 'glob'
import watch from 'node-watch'
import {cpus} from 'os'
import master from '../master'

function tests(description, {argv}) {
  describe(description, () => {
    let state, workerCount

    beforeEach(() => {
      workerCount = argv.workerCount < 1 ? cpus().length - 1 : argv.workerCount
      state = master(argv)
    })

    it('functions as expected', () => {
      const workers = []

      for (let id = 1; id <= workerCount; id++) {
        workers.push({
          idle: true,
          worker: {
            id,
            on: expect.any(Function),
          },
        })
      }

      expect(cluster.fork).toHaveBeenCalledTimes(workerCount)
      expect(cluster.on).toHaveBeenCalledTimes(1)
      expect(cluster.on).toHaveBeenCalledWith('exit', expect.any(Function))
      expect(console.info).toHaveBeenCalledTimes(1)
      expect(console.info).toHaveBeenCalledWith(
        `Spawned ${workerCount} workers`,
      )
      expect(glob).toHaveBeenCalledTimes(1)
      expect(glob).toHaveBeenCalledWith(
        `${argv.source.replace(/\/$/, '')}/**/*`,
        expect.any(Function),
      )
      expect(state).toEqual({
        erred: false,
        isWatching: argv.watch,
        queue: [],
        workers,
      })
      expect(watch).toHaveBeenCalledTimes(argv.watch ? 1 : 0)

      if (argv.isWatching) {
        expect(watch).toHaveBeenCalledWith(
          argv.source,
          {recursive: true},
          expect.any(Function),
        )
      }

      state.workers.forEach(({worker}) => {
        expect(worker.on).toHaveBeenCalledTimes(1)
        expect(worker.on).toHaveBeenCalledWith('message', expect.any(Function))
      })
    })
  })
}

describe('master', () => {
  beforeAll(() => {
    jest.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterAll(() => {
    console.info.mockRestore()
  })

  beforeEach(() => {
    let nextWorkerId = 1

    cluster.fork.mockReset().mockImplementation(() => {
      return {
        id: nextWorkerId++,
        on: jest.fn(),
      }
    })

    cluster.on.mockReset()
    console.info.mockReset()

    cpus.mockReturnValue({
      length: 8,
    })

    glob.mockReset()
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
