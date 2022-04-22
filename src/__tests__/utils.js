/** @flow */

/**
 * @typedef Resolver
 * An object used to control when a Promise is resolved/rejected
 * @property {Function} resolve - resolve the promise
 * @property {Function} reject - reject the promise
 * @property {Promise} promise - the promise to resolve/reject
 */

type RejectFn = (error: any) => void
type ResolveFn<T> = (value: T) => void

function maybeUpdate(wrapper: any) {
  if (wrapper) {
    wrapper.update()
  }
}

/**
 * Create a Resolver instance
 * @returns {Resolver} - the instance
 */
export default class Resolver<T> {
  promise: Promise<T>
  rawReject: RejectFn
  rawResolve: ResolveFn<T>

  constructor() {
    this.promise = new Promise((resolve: ResolveFn<T>, reject: RejectFn) => {
      this.rawResolve = resolve
      this.rawReject = reject
    })
  }

  /**
   * Resolve the wrapped promise
   * @param {*} resolution - the value to resolve with
   * @param {Enzyme.Wrapper} [wrapper] - optional enzyme wrapper to update after resolving
   * @returns {Promise} a chained promise from the wrapped one
   */
  reject(rejection: any, wrapper: any): Promise<T> {
    this.rawReject(rejection)
    return this.promise.catch(err => {
      maybeUpdate(wrapper)
      return err
    })
  }

  /**
   * Resolve the wrapped promise
   * @param {*} resolution - the value to resolve with
   * @param {Enzyme.Wrapper} [wrapper] - optional enzyme wrapper to update after resolving
   * @returns {Promise} a chained promise from the wrapped one
   */
  resolve(resolution: T, wrapper: any): Promise<T> {
    this.rawResolve(resolution)
    return this.promise.then(resp => {
      maybeUpdate(wrapper)
      return resp
    })
  }
}
