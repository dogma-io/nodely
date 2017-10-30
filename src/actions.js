export const IDLE = 'IDLE'
export const REMOVE_FILE = 'REMOVE_FILE'
export const TRANSFORM_FILE = 'TRANSFORM_FILE'

export type IdleAction = {|
  type: 'IDLE',
|}

export type RemoveFileAction = {|
  type: 'REMOVE_FILE',
|}

export type TransformFileAction = {|
  type: 'TRANSFORM_FILE',
|}
