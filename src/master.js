import cluster from 'cluster'
import glob from 'glob'
import watch from 'node-watch'
import {cpus} from 'os'
import {sep} from 'path'

import {IDLE, type IdleAction, REMOVE_FILE, TRANSFORM_FILE} from './actions'
import type {Argv} from './types'

/**
 * @see https://nodejs.org/api/cluster.html#cluster_class_worker
 */
type Worker = {|
  id: number,
|}

type WorkerInfo = {|
  idle: boolean, // whether or not process is idle and waiting for a task
  worker: Worker, // worker instance
|}

/**
 * Get worker info for worker.
 * @param worker - worker to get info for
 * @returns worker info
 */
function getWorkerInfo(worker: Worker): WorkerInfo {
  return {
    idle: true,
    worker,
  }
}

/**
 * Process actions from worker.
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 * @param workerInfo - info for worker action is from
 * @param data - action from worker
 */
function processActionFromWorker(
  queue: string[],
  workers: WorkerInfo[],
  isWatching: boolean,
  workerInfo: WorkerInfo,
  data: IdleAction,
) {
  if (typeof data !== 'object') {
    throw new Error(
      `Expected message from worker to be an object but instead received type ${typeof data}`,
    )
  }

  if (data === null) {
    throw new Error(
      'Expected message from worker to be present but instead received null',
    )
  }

  switch (data.type) {
    case IDLE:
      workerInfo.idle = true
      processNextAction(queue, workers, isWatching)
      break

    default:
      throw new Error(
        `Worker sent message with unknown action type ${data.type}`,
      )
  }
}

/**
 * Process files from glob call.
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 * @param err - error (only present when something went wrong)
 * @param files - full file paths to process
 */
function processFiles(
  queue: string[],
  workers: WorkerInfo[],
  isWatching: boolean,
  err: ?Error,
  files: string[],
) {
  if (err) {
    throw err
  }

  console.info(`Queuing up ${files.length} files to be processed`)

  const actions = files
    .filter((filePath: string) => !/(__mocks__|__tests__)/.test(filePath))
    .map((filePath: string) => {
      return {
        filePath,
        type: TRANSFORM_FILE,
      }
    })

  queue.push(...actions)

  while (queue.length && processNextAction(queue, workers, isWatching)) {}
}

/**
 * Process next action in queue.
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 * @returns whether or not there are more idle workers
 */
function processNextAction(
  queue: string[],
  workers: WorkerInfo[],
  isWatching: boolean,
): boolean {
  if (
    !isWatching &&
    queue.length === 0 &&
    workers.every((w: WorkerInfo) => w.idle)
  ) {
    process.exit()
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
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 * @param type - watch event type
 * @param filePath - full path of file event is for
 */
function processWatchEvent(
  queue: string[],
  workers: WorkerInfo[],
  isWatching: boolean,
  type: string,
  filePath: string,
) {
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
  processNextAction(queue, workers, isWatching)
}

/**
 * Listen for dead workers and spawn new workers in their place.
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 */
function replaceDeadWorkers(
  queue: string[],
  workers: WorkerInfo[],
  isWatching: boolean,
) {
  cluster.on('exit', (deadWorker: Worker) => {
    console.info(
      `Worker ${deadWorker.id} died, spawning a new worker in it's place`,
    )

    // Remove dead worker from worker info list
    const deadWorkerIndex = workers.findIndex((w: WorkerInfo) => {
      return w.worker === deadWorker
    })
    workers.splice(deadWorkerIndex, 1)

    // Add a new worker in it's place
    spawnWorker(queue, workers, isWatching)
  })
}

/**
 * Spawn a single worker process and add it to list of workers.
 * @param queue - queue of files needing to be transpiled
 * @param info for each worker
 * @param isWatching - whether or not watcher is enabled
 */
function spawnWorker(
  queue: string[],
  workers: WorkerInfo[],
  isWatching: boolean,
) {
  const worker = cluster.fork()
  const workerInfo = getWorkerInfo(worker)

  worker.on(
    'message',
    processActionFromWorker.bind(null, queue, workers, isWatching, workerInfo),
  )

  workers.push(workerInfo)
}

/**
 * Spawn worker processes
 * @param queue - queue of files needing to be transpiled
 * @param workerCount - number of workers to spawn
 * @param isWatching - whether or not watcher is enabled
 * @returns info for each worker
 */
function spawnWorkers(
  queue: string[],
  workerCount: number,
  isWatching: boolean,
): WorkerInfo[] {
  if (isNaN(workerCount)) {
    throw new Error(
      `workerCount is expected to be a number not ${typeof workerCount}`,
    )
  }

  if (workerCount <= 1) {
    workerCount = cpus().length - 1
  }

  const workers = []

  for (let i = workerCount; i > 0; i--) {
    spawnWorker(queue, workers, isWatching)
  }

  console.info(`Spawned ${workerCount} workers`)

  return workers
}

/**
 * Spin up master process.
 * @param argv - command line arguments
 */
export default function(argv: Argv) {
  let {source, watch: isWatching, workerCount} = argv
  const queue = []
  const workers = spawnWorkers(queue, workerCount, isWatching)

  replaceDeadWorkers(queue, workers, isWatching)

  // Make sure source does not have a trailing separator
  if (source[source.length - 1] === sep) {
    source = source.substr(0, source.length - 1)
  }

  // If we are in watch mode make sure to watch source directory for changes
  if (isWatching) {
    watch(
      source,
      {recursive: true},
      processWatchEvent.bind(null, queue, workers, isWatching),
    )
  }

  // Make sure we process all source files
  glob(
    `${source}${sep}**${sep}*`,
    processFiles.bind(null, queue, workers, isWatching),
  )
}
