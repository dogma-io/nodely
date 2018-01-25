/**
 * @flow
 */

/* global cluster$Worker */

import cluster from 'cluster'
import glob from 'glob'
import watch from 'node-watch'
import {cpus} from 'os'
import {sep} from 'path'

import {IDLE, type IdleAction, REMOVE_FILE, TRANSFORM_FILE} from './actions'
import type {Argv} from './types'

type Action = {|
  filePath: string,
  type: REMOVE_FILE | TRANSFORM_FILE,
|}

type WorkerInfo = {|
  idle: boolean, // whether or not process is idle and waiting for a task
  worker: cluster$Worker, // worker instance
|}

type State = {|
  erred: boolean,
  isWatching: boolean,
  queue: Action[],
  workers: WorkerInfo[],
|}

const FAILURE_EXIT_CODE = 1
const SUCCESS_EXIT_CODE = 0

/**
 * Get worker info for worker.
 * @param worker - worker to get info for
 * @returns worker info
 */
function getWorkerInfo(worker: cluster$Worker): WorkerInfo {
  return {
    idle: true,
    worker,
  }
}

/**
 * Process actions from worker.
 * @param state - current state
 * @param workerInfo - info for worker action is from
 * @param data - action from worker
 */
function processActionFromWorker(
  state: State,
  workerInfo: WorkerInfo,
  data: IdleAction,
) {
  if (typeof data !== 'object') {
    console.error(
      `Expected message from worker to be an object but instead received type ${typeof data}`,
    )
    return
  }

  if (data === null) {
    console.error(
      'Expected message from worker to be present but instead received null',
    )
    return
  }

  switch (data.type) {
    case IDLE:
      if (data.erred) {
        state.erred = true
      }

      workerInfo.idle = true
      processNextAction(state)
      return

    default:
      console.error(`Worker sent message with unknown action type ${data.type}`)
  }
}

/**
 * Process files from glob call.
 * @param state - current state
 * @param err - error (only present when something went wrong)
 * @param files - full file paths to process
 */
function processFiles(state: State, err: ?Error, files: string[]) {
  const {queue} = state

  if (err) {
    throw err
  }

  console.info(`Queuing up ${files.length} files to be processed`)

  const actions = files
    .filter((filePath: string): boolean => {
      return !/(__mocks__|__tests__)/.test(filePath)
    })
    .map((filePath: string): Action => {
      return {
        filePath,
        type: TRANSFORM_FILE,
      }
    })

  queue.push(...actions)

  while (queue.length && processNextAction(state)) {}

  processNextAction(state) // Will trigger exit if queue is empty
}

/**
 * Process next action in queue.
 * @param state - current state
 * @returns whether or not there are more idle workers
 */
function processNextAction(state: State): boolean {
  const {erred, isWatching, queue, workers} = state

  if (
    !isWatching &&
    queue.length === 0 &&
    workers.every((w: WorkerInfo): boolean => {
      return w.idle
    })
  ) {
    process.exit(erred ? FAILURE_EXIT_CODE : SUCCESS_EXIT_CODE)
  }

  let processing = false

  for (let i = workers.length - 1; i >= 0; i--) {
    const workerInfo = workers[i]

    if (workerInfo.idle) {
      // If we have already begun processing the next file and there is still
      // at least one idle worker left.
      if (processing) {
        return true
      }

      if (queue.length) {
        // Have idle worker process action
        const action = queue.shift()
        workerInfo.idle = false
        workerInfo.worker.send(action)
        processing = true
      }
    }
  }

  // There are no more idle workers left
  return false
}

/**
 * Process files from glob call.
 * @param state - current state
 * @param type - watch event type
 * @param filePath - full path of file event is for
 */
function processWatchEvent(state: State, type: string, filePath: string) {
  const {queue} = state

  switch (type) {
    case 'remove':
      queue.push({
        filePath,
        type: REMOVE_FILE,
      })
      break

    case 'update':
      queue.push({
        filePath,
        type: TRANSFORM_FILE,
      })
      break
  }

  // This is needed to process the above action in the scenario all workers are
  // idle. Otherwise the workers should pick up the next task anyways once they
  // become idle.
  processNextAction(state)
}

/**
 * Listen for dead workers and spawn new workers in their place.
 * @param state - current state
 */
function replaceDeadWorkers(state: State) {
  const {workers} = state

  cluster.on('exit', (deadWorker: cluster$Worker) => {
    console.info(
      `Worker ${deadWorker.id} died, spawning a new worker in it's place`,
    )

    // Remove dead worker from worker info list
    const deadWorkerIndex = workers.findIndex((w: WorkerInfo): boolean => {
      return w.worker.id === deadWorker.id
    })
    workers.splice(deadWorkerIndex, 1)

    // Add a new worker in it's place
    spawnWorker(state)
  })
}

/**
 * Spawn a single worker process and add it to list of workers.
 * @param state - current state
 */
function spawnWorker(state: State) {
  const {workers} = state
  const worker = cluster.fork()
  const workerInfo = getWorkerInfo(worker)

  worker.on('message', processActionFromWorker.bind(null, state, workerInfo))
  workers.push(workerInfo)
}

/**
 * Spawn worker processes
 * @param state - current state
 * @param workerCount - number of workers to spawn
 */
function spawnWorkers(state: State, workerCount: number) {
  if (isNaN(workerCount)) {
    throw new Error(
      `workerCount is expected to be a number not ${typeof workerCount}`,
    )
  }

  if (workerCount < 1) {
    workerCount = cpus().length - 1
  }

  for (let i = workerCount; i > 0; i--) {
    spawnWorker(state)
  }

  console.info(`Spawned ${workerCount} workers`)
}

/**
 * Spin up master process.
 * @param argv - command line arguments
 */
export default function(argv: Argv): State {
  let {source, watch: isWatching, workerCount} = argv

  const state = {
    erred: false,
    isWatching,
    queue: [],
    workers: [],
  }

  spawnWorkers(state, workerCount)
  replaceDeadWorkers(state)

  // Make sure source does not have a trailing separator
  if (source[source.length - 1] === sep) {
    source = source.substr(0, source.length - 1)
  }

  // If we are in watch mode make sure to watch source directory for changes
  if (isWatching) {
    watch(source, {recursive: true}, processWatchEvent.bind(null, state))
  }

  // Make sure we process all source files
  glob(`${source}${sep}**${sep}*`, processFiles.bind(null, state))

  return state // used by tests
}
