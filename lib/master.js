'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = function (argv) {
  var source = argv.source,
      isWatching = argv.watch,
      workerCount = argv.workerCount;

  var queue = [];
  var workers = spawnWorkers(queue, workerCount, isWatching);

  replaceDeadWorkers(queue, workers, isWatching);

  // Make sure source does not have a trailing separator
  if (source[source.length - 1] === _path.sep) {
    source = source.substr(0, source.length - 1);
  }

  // If we are in watch mode make sure to watch source directory for changes
  if (isWatching) {
    (0, _nodeWatch2.default)(source, { recursive: true }, processWatchEvent.bind(null, queue, workers, isWatching));
  }

  // Make sure we process all source files
  (0, _glob2.default)('' + source + _path.sep + '**' + _path.sep + '*', processFiles.bind(null, queue, workers, isWatching));
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
 * Get worker info for worker.
 * @param worker - worker to get info for
 * @returns worker info
 */


/**
 * @see https://nodejs.org/api/cluster.html#cluster_class_worker
 */
function getWorkerInfo(worker) {
  return {
    idle: true,
    worker: worker
  };
}

/**
 * Process actions from worker.
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 * @param workerInfo - info for worker action is from
 * @param data - action from worker
 */
function processActionFromWorker(queue, workers, isWatching, workerInfo, data) {
  if ((typeof data === 'undefined' ? 'undefined' : _typeof(data)) !== 'object') {
    throw new Error('Expected message from worker to be an object but instead received type ' + (typeof data === 'undefined' ? 'undefined' : _typeof(data)));
  }

  if (data === null) {
    throw new Error('Expected message from worker to be present but instead received null');
  }

  switch (data.type) {
    case _actions.IDLE:
      workerInfo.idle = true;
      processNextAction(queue, workers, isWatching);
      break;

    default:
      throw new Error('Worker sent message with unknown action type ' + data.type);
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
function processFiles(queue, workers, isWatching, err, files) {
  if (err) {
    throw err;
  }

  console.info('Queuing up ' + files.length + ' files to be processed');

  var actions = files.filter(function (filePath) {
    return !/(__mocks__|__tests__)/.test(filePath);
  }).map(function (filePath) {
    return {
      filePath: filePath,
      type: _actions.TRANSFORM_FILE
    };
  });

  queue.push.apply(queue, _toConsumableArray(actions));

  while (queue.length && processNextAction(queue, workers, isWatching)) {}
}

/**
 * Process next action in queue.
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 * @returns whether or not there are more idle workers
 */
function processNextAction(queue, workers, isWatching) {
  if (!isWatching && queue.length === 0 && workers.every(function (w) {
    return w.idle;
  })) {
    process.exit();
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
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 * @param type - watch event type
 * @param filePath - full path of file event is for
 */
function processWatchEvent(queue, workers, isWatching, type, filePath) {
  switch (type) {
    case 'remove':
      queue.push({
        filePath: filePath,
        type: _actions.REMOVE_FILE
      });
      break;

    case 'update':
      queue.push({
        filePath: filePath,
        type: _actions.TRANSFORM_FILE
      });
      break;
  }

  // This is needed to process the above action in the scenario all workers are
  // idle. Otherwise the workers should pick up the next task anyways once they
  // become idle.
  processNextAction(queue, workers, isWatching);
}

/**
 * Listen for dead workers and spawn new workers in their place.
 * @param queue - queue of files needing to be transpiled
 * @param workers - info for each worker
 * @param isWatching - whether or not watcher is enabled
 */
function replaceDeadWorkers(queue, workers, isWatching) {
  _cluster2.default.on('exit', function (deadWorker) {
    console.info('Worker ' + deadWorker.id + ' died, spawning a new worker in it\'s place');

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
 * @param queue - queue of files needing to be transpiled
 * @param info for each worker
 * @param isWatching - whether or not watcher is enabled
 */
function spawnWorker(queue, workers, isWatching) {
  var worker = _cluster2.default.fork();
  var workerInfo = getWorkerInfo(worker);

  worker.on('message', processActionFromWorker.bind(null, queue, workers, isWatching, workerInfo));

  workers.push(workerInfo);
}

/**
 * Spawn worker processes
 * @param queue - queue of files needing to be transpiled
 * @param workerCount - number of workers to spawn
 * @param isWatching - whether or not watcher is enabled
 * @returns info for each worker
 */
function spawnWorkers(queue, workerCount, isWatching) {
  if (isNaN(workerCount)) {
    throw new Error('workerCount is expected to be a number not ' + (typeof workerCount === 'undefined' ? 'undefined' : _typeof(workerCount)));
  }

  if (workerCount <= 1) {
    workerCount = (0, _os.cpus)().length - 1;
  }

  var workers = [];

  for (var i = workerCount; i > 0; i--) {
    spawnWorker(queue, workers, isWatching);
  }

  console.info('Spawned ' + workerCount + ' workers');

  return workers;
}

/**
 * Spin up master process.
 * @param argv - command line arguments
 */