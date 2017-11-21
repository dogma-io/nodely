function missingArgumentsTest(message) {
  require('../index')
  expect(console.error).toHaveBeenCalledTimes(2)
  expect(console.error).toHaveBeenCalledWith(`Options:
  --help             Show help                                         [boolean]
  --version          Show version number                               [boolean]
  --output, -o       Directory where transformed code should be output.
                                                             [string] [required]
  --source, -s       Directory containing source code to transform.
                                                             [string] [required]
  --target, -t       Target Node version.                [string] [default: "4"]
  --verbose, -v      Whether or not to have verbose logging.
                                                      [boolean] [default: false]
  --watch, -w        Whether or not to watch for changes and continue
                     transpiling.                     [boolean] [default: false]
  --workerCount, -n  Number of worker process to spawn.    [number] [default: 0]
`)
  expect(console.error).toHaveBeenCalledWith(message)
  expect(process.exit).toHaveBeenCalledTimes(1)
}

describe('index', () => {
  let cluster, master, worker

  beforeEach(() => {
    jest.resetModules()

    jest.mock('cluster')
    jest.mock('../master')
    jest.mock('../worker')

    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(process, 'exit').mockImplementation(() => {})

    cluster = require('cluster')
    master = require('../master').default
    worker = require('../worker').default
  })

  afterEach(() => {
    console.error.mockReset()
    process.exit.mockReset()
  })

  it('functions as expected when required arguments are missing', () => {
    missingArgumentsTest('Missing required arguments: output, source')
  })

  it('functions as expected when output argument is missing', () => {
    process.argv = ['node', 'index.js', '-s', '/foo']
    missingArgumentsTest('Missing required argument: output')
  })

  it('functions as expected when source argument is missing', () => {
    process.argv = ['node', 'index.js', '-o', '/foo']
    missingArgumentsTest('Missing required argument: source')
  })

  describe('when required arguments are present and rest are defaults', () => {
    beforeEach(() => {
      process.argv = ['node', 'index.js', '-s', '/foo', '-o', '/bar']
    })

    it('functions as expected when process is cluster master', () => {
      cluster.isMaster = true
      require('../index')
      expect(master).toHaveBeenCalledTimes(1)
      expect(master).toHaveBeenCalledWith(
        expect.objectContaining({
          output: '/bar',
          source: '/foo',
          watch: false,
          workerCount: 0,
        }),
      )
      expect(worker).toHaveBeenCalledTimes(0)
    })

    it('functions as expected when process is cluster worker', () => {
      cluster.isMaster = false
      require('../index')
      expect(master).toHaveBeenCalledTimes(0)
      expect(worker).toHaveBeenCalledTimes(1)
      expect(worker).toHaveBeenCalledWith(
        expect.objectContaining({
          output: '/bar',
          source: '/foo',
          watch: false,
          workerCount: 0,
        }),
      )
    })
  })

  describe('when required arguments are present and rest are overriden', () => {
    beforeEach(() => {
      process.argv = [
        'node',
        'index.js',
        '-s',
        '/foo',
        '-o',
        '/bar',
        '-w',
        '-n',
        '3',
      ]
    })

    it('functions as expected when process is cluster master', () => {
      cluster.isMaster = true
      require('../index')
      expect(master).toHaveBeenCalledTimes(1)
      expect(master).toHaveBeenCalledWith(
        expect.objectContaining({
          output: '/bar',
          source: '/foo',
          watch: true,
          workerCount: 3,
        }),
      )
      expect(worker).toHaveBeenCalledTimes(0)
    })

    it('functions as expected when process is cluster worker', () => {
      cluster.isMaster = false
      require('../index')
      expect(master).toHaveBeenCalledTimes(0)
      expect(worker).toHaveBeenCalledTimes(1)
      expect(worker).toHaveBeenCalledWith(
        expect.objectContaining({
          output: '/bar',
          source: '/foo',
          watch: true,
          workerCount: 3,
        }),
      )
    })
  })
})
