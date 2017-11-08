import {IDLE} from '../actions'
import worker from '../worker'

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

    // TODO: REMOVE_FILE action tests
    // TODO: TRANSFORM_FILE action tests
  })
}

describe('worker', () => {
  const ctx = {}

  beforeEach(() => {
    process.send = jest.fn()
    jest.spyOn(console, 'error').mockImplementation(() => {})

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
    console.error.mockRestore()
  })

  tests(ctx, 'when output and source has trailing separator', {
    source: '/foo/',
    output: '/bar/',
  })

  tests(ctx, 'when output has trailing separator', {
    source: '/foo',
    output: '/bar/',
  })

  tests(ctx, 'when source has trailing separator', {
    source: '/foo/',
    output: '/bar',
  })

  tests(ctx, 'when neither output nor source has trailing separator', {
    source: '/foo',
    output: '/bar',
  })
})
