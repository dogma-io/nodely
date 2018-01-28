/**
 * @flow
 */

export type Argv = {|
  include: ?string,
  output: string,
  source: string,
  target: string,
  verbose: boolean,
  watch: boolean,
  workerCount: number,
|}
