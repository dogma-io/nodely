/**
 * @flow
 */

export const IDLE: 'IDLE' = 'IDLE'
export const REMOVE_FILE: 'REMOVE_FILE' = 'REMOVE_FILE'
export const TRANSFORM_FILE: 'TRANSFORM_FILE' = 'TRANSFORM_FILE'

export type IdleAction = {|
  erred: boolean,
  type: 'IDLE',
|}

export type RemoveFileAction = {|
  filePath: string,
  type: 'REMOVE_FILE',
|}

export type TransformFileAction = {|
  filePath: string,
  type: 'TRANSFORM_FILE',
|}
