"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.master = master;

var _glob = _interopRequireDefault(require("glob"));

var _nodeWatch = _interopRequireDefault(require("node-watch"));

var _os = require("os");

var _path = require("path");

var _actions = require("./actions");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

var FAILURE_EXIT_CODE = 1;
var SUCCESS_EXIT_CODE = 0;
/**
 * Get worker info for worker.
 * @param worker - worker to get info for
 * @returns worker info
 */

function getWorkerInfo(worker) {
  return {
    idle: false,
    worker: worker
  };
}
/**
 * Process actions from worker.
 * @param state - current state
 * @param workerInfo - info for worker action is from
 * @param data - action from worker
 */


function processActionFromWorker(state, workerInfo, data) {
  if (_typeof(data) !== 'object') {
    console.error("Expected message from worker to be an object but instead received type ".concat(_typeof(data)));
    process.exit(FAILURE_EXIT_CODE);
  } else if (data === null) {
    console.error('Expected message from worker to be present but instead received null');
    process.exit(FAILURE_EXIT_CODE);
  } else {
    switch (data.type) {
      case _actions.IDLE:
        if (state.verbose) {
          console.info("Worker ".concat(workerInfo.worker.id, " idle"));
        }

        if (data.erred) {
          state.erred = true;
        }

        workerInfo.idle = true;
        processNextAction(state);
        return;

      default:
        console.error("Worker sent message with unknown action type ".concat(data.type));
        process.exit(FAILURE_EXIT_CODE);
    }
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

  console.info("Queuing up ".concat(files.length, " files to be processed"));
  var actions = files.filter(function (filePath) {
    return !/(__mocks__|__tests__)/.test(filePath);
  }).map(function (filePath) {
    return {
      filePath: filePath,
      type: _actions.TRANSFORM_FILE
    };
  });
  queue.push.apply(queue, _toConsumableArray(actions));

  while (queue.length && processNextAction(state)) {}

  processNextAction(state); // Will trigger exit if queue is empty
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
      verbose = state.verbose,
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

        if (verbose) {
          console.info("Sending action to worker ".concat(workerInfo.worker.id), JSON.stringify(action));
        }

        workerInfo.worker.send(action);
        processing = true;
      }
    }
  } // There are no more idle workers left


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
  } // This is needed to process the above action in the scenario all workers are
  // idle. Otherwise the workers should pick up the next task anyways once they
  // become idle.


  processNextAction(state);
}
/**
 * Listen for dead workers and spawn new workers in their place.
 * @param fork - fork method
 * @param on - event listener
 * @param state - current state
 */


function replaceDeadWorkers(fork, on, state) {
  var workers = state.workers;
  on('exit', function (deadWorker) {
    console.info("Worker ".concat(deadWorker.id, " died, spawning a new worker in it's place")); // Remove dead worker from worker info list

    var deadWorkerIndex = workers.findIndex(function (w) {
      return w.worker.id === deadWorker.id;
    });
    workers.splice(deadWorkerIndex, 1); // Add a new worker in it's place

    spawnWorker(fork, state);
  });
}
/**
 * Spawn a single worker process and add it to list of workers.
 * @param fork - fork method
 * @param state - current state
 */


function spawnWorker(fork, state) {
  var workers = state.workers;
  var worker = fork();
  var workerInfo = getWorkerInfo(worker);
  worker.on('message', processActionFromWorker.bind(null, state, workerInfo));
  workers.push(workerInfo);
}
/**
 * Spawn worker processes
 * @param fork - fork method
 * @param state - current state
 * @param workerCount - number of workers to spawn
 */


function spawnWorkers(fork, state, workerCount) {
  if (isNaN(workerCount)) {
    throw new Error("workerCount is expected to be a number not ".concat(_typeof(workerCount)));
  }

  if (workerCount < 1) {
    workerCount = (0, _os.cpus)().length - 1;
  }

  for (var i = workerCount; i > 0; i--) {
    spawnWorker(fork, state);
  }

  console.info("Spawned ".concat(workerCount, " workers"));
}
/**
 * Spin up master process.
 * @param argv - command line arguments
 * @param fork - fork method
 * @param on - event listener
 */


function master(argv, fork, on) {
  var source = argv.source,
      isWatching = argv.watch,
      verbose = argv.verbose,
      workerCount = argv.workerCount;
  var state = {
    erred: false,
    isWatching: isWatching,
    queue: [],
    verbose: verbose,
    workers: []
  };
  spawnWorkers(fork, state, workerCount);
  replaceDeadWorkers(fork, on, state); // Make sure source does not have a trailing separator

  if (source[source.length - 1] === _path.sep) {
    source = source.substr(0, source.length - 1);
  } // If we are in watch mode make sure to watch source directory for changes


  if (isWatching) {
    (0, _nodeWatch.default)(source, {
      recursive: true
    }, processWatchEvent.bind(null, state));
  } // Make sure we process all source files


  (0, _glob.default)("".concat(source).concat(_path.sep, "**").concat(_path.sep, "*"), processFiles.bind(null, state));
  return state; // used by tests
}