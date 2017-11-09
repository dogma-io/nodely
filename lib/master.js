'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (argv) {
  var source = argv.source,
      isWatching = argv.watch,
      workerCount = argv.workerCount;


  var state = {
    erred: false,
    isWatching,
    queue: [],
    workers: []
  };

  spawnWorkers(state, workerCount);
  replaceDeadWorkers(state);

  // Make sure source does not have a trailing separator
  if (source[source.length - 1] === _path.sep) {
    source = source.substr(0, source.length - 1);
  }

  // If we are in watch mode make sure to watch source directory for changes
  if (isWatching) {
    (0, _nodeWatch2.default)(source, { recursive: true }, processWatchEvent.bind(null, state));
  }

  // Make sure we process all source files
  (0, _glob2.default)(`${source}${_path.sep}**${_path.sep}*`, processFiles.bind(null, state));
};

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

var _glob = require('glob');

var _glob2 = _interopRequireDefault(_glob);

var _nodeWatch = require('node-watch');

var _nodeWatch2 = _interopRequireDefault(_nodeWatch);

var _os = require('os');

var _path = require('path');

var _actions = require('./actions');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

/**
 * @see https://nodejs.org/api/cluster.html#cluster_class_worker
 */
var FAILURE_EXIT_CODE = 1;
var SUCCESS_EXIT_CODE = 0;

/**
 * Get worker info for worker.
 * @param worker - worker to get info for
 * @returns worker info
 */
function getWorkerInfo(worker) {
  return {
    idle: true,
    worker
  };
}

/**
 * Process actions from worker.
 * @param state - current state
 * @param workerInfo - info for worker action is from
 * @param data - action from worker
 */
function processActionFromWorker(state, workerInfo, data) {
  if (typeof data !== 'object') {
    throw new Error(`Expected message from worker to be an object but instead received type ${typeof data}`);
  }

  if (data === null) {
    throw new Error('Expected message from worker to be present but instead received null');
  }

  switch (data.type) {
    case _actions.IDLE:
      if (data.erred) {
        state.erred = true;
      }

      workerInfo.idle = true;
      processNextAction(state);
      break;

    default:
      throw new Error(`Worker sent message with unknown action type ${data.type}`);
  }
}

/**
 * Process files from glob call.
 * @param state - current state
 * @param err - error (only present when something went wrong)
 * @param files - full file paths to process
 */
function processFiles(state, err, files) {
  var queue = state.queue;


  if (err) {
    throw err;
  }

  console.info(`Queuing up ${files.length} files to be processed`);

  var actions = files.filter(function (filePath) {
    return !/(__mocks__|__tests__)/.test(filePath);
  }).map(function (filePath) {
    return {
      filePath,
      type: _actions.TRANSFORM_FILE
    };
  });

  queue.push.apply(queue, _toConsumableArray(actions));

  while (queue.length && processNextAction(state)) {}
}

/**
 * Process next action in queue.
 * @param state - current state
 * @returns whether or not there are more idle workers
 */
function processNextAction(state) {
  var erred = state.erred,
      isWatching = state.isWatching,
      queue = state.queue,
      workers = state.workers;


  if (!isWatching && queue.length === 0 && workers.every(function (w) {
    return w.idle;
  })) {
    process.exit(erred ? FAILURE_EXIT_CODE : SUCCESS_EXIT_CODE);
  }

  var processing = false;

  for (var i = workers.length - 1; i >= 0; i--) {
    var workerInfo = workers[i];

    if (workerInfo.idle) {
      // If we have already begun processing the next file and there is still
      // at least one idle worker left.
      if (processing) {
        return true;
      }

      if (queue.length) {
        // Have idle worker process action
        var action = queue.shift();
        workerInfo.idle = false;
        workerInfo.worker.send(action);
        processing = true;
      }
    }
  }

  // There are no more idle workers left
  return false;
}

/**
 * Process files from glob call.
 * @param state - current state
 * @param type - watch event type
 * @param filePath - full path of file event is for
 */
function processWatchEvent(state, type, filePath) {
  var queue = state.queue;


  switch (type) {
    case 'remove':
      queue.push({
        filePath,
        type: _actions.REMOVE_FILE
      });
      break;

    case 'update':
      queue.push({
        filePath,
        type: _actions.TRANSFORM_FILE
      });
      break;
  }

  // This is needed to process the above action in the scenario all workers are
  // idle. Otherwise the workers should pick up the next task anyways once they
  // become idle.
  processNextAction(state);
}

/**
 * Listen for dead workers and spawn new workers in their place.
 * @param state - current state
 */
function replaceDeadWorkers(state) {
  var isWatching = state.isWatching,
      queue = state.queue,
      workers = state.workers;


  _cluster2.default.on('exit', function (deadWorker) {
    console.info(`Worker ${deadWorker.id} died, spawning a new worker in it's place`);

    // Remove dead worker from worker info list
    var deadWorkerIndex = workers.findIndex(function (w) {
      return w.worker === deadWorker;
    });
    workers.splice(deadWorkerIndex, 1);

    // Add a new worker in it's place
    spawnWorker(queue, workers, isWatching);
  });
}

/**
 * Spawn a single worker process and add it to list of workers.
 * @param state - current state
 */
function spawnWorker(state) {
  var workers = state.workers;

  var worker = _cluster2.default.fork();
  var workerInfo = getWorkerInfo(worker);

  worker.on('message', processActionFromWorker.bind(null, state, workerInfo));
  workers.push(workerInfo);
}

/**
 * Spawn worker processes
 * @param state - current state
 * @param workerCount - number of workers to spawn
 */
function spawnWorkers(state, workerCount) {
  if (isNaN(workerCount)) {
    throw new Error(`workerCount is expected to be a number not ${typeof workerCount}`);
  }

  if (workerCount <= 1) {
    workerCount = (0, _os.cpus)().length - 1;
  }

  for (var i = workerCount; i > 0; i--) {
    spawnWorker(state);
  }

  console.info(`Spawned ${workerCount} workers`);
}

/**
 * Spin up master process.
 * @param argv - command line arguments
 */