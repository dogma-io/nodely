/**
 * @flow
 */

export type Argv = {|
  include: ?string,
  output: string,
  source: string,
  target?: string,
  verbose: boolean,
  watch: boolean,
  workerCount: number,
|}

export type ProcessSend = (
  /* eslint-disable flowtype/no-weak-types */
  message: any,
  sendHandleOrCallback?: any,
  callback?: Function,
  /* eslint-enable flowtype/no-weak-types */
) => void
