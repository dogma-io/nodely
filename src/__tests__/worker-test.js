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
      expect(() => {
        ctx.listeners.message[0]('test')
      }).toThrow(
        new Error(
          'Expected message from master to be an object but instead received type string',
        ),
      )
    })

    it('functions as expected when master sends null message', () => {
      expect(ctx.listeners.message).toHaveLength(1)
      expect(() => {
        ctx.listeners.message[0](null)
      }).toThrow(
        new Error(
          'Expected message from master to be present but instead received null',
        ),
      )
    })

    it('functions as expected when master sends message with unknown action type', () => {
      expect(ctx.listeners.message).toHaveLength(1)
      expect(() => {
        ctx.listeners.message[0]({type: 'FOO_BAR'})
      }).toThrow(
        new Error('Master sent message with unknown action type FOO_BAR'),
      )
    })

    // TODO: REMOVE_FILE action tests
    // TODO: TRANSFORM_FILE action tests
  })
}

describe('worker', () => {
  const ctx = {}

  beforeEach(() => {
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
