#! /usr/bin/env node
"use strict";

var _cluster = _interopRequireDefault(require("cluster"));

var _yargs = _interopRequireDefault(require("yargs"));

var _master = require("./master");

var _worker = require("./worker");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var argv = _yargs["default"].option('include', {
  alias: 'i',
  description: 'Only include files matching this regex.',
  type: 'string'
}).option('output', {
  alias: 'o',
  demandOption: true,
  description: 'Directory where transformed code should be output.',
  type: 'string'
}).option('source', {
  alias: 's',
  demandOption: true,
  description: 'Directory containing source code to transform.',
  type: 'string'
}).option('target', {
  alias: 't',
  description: 'Target Node version.',
  type: 'string'
}).option('verbose', {
  alias: 'v',
  "default": false,
  description: 'Whether or not to have verbose logging.',
  type: 'boolean'
}).option('watch', {
  alias: 'w',
  "default": false,
  description: 'Whether or not to watch for changes and continue transpiling.',
  type: 'boolean'
}).option('workerCount', {
  alias: 'n',
  "default": 0,
  description: 'Number of worker process to spawn.',
  type: 'number'
}).argv; // eslint-disable-line
// TODO: verify source directory exists


if (_cluster["default"].isMaster) {
  var fork = _cluster["default"].fork.bind(_cluster["default"]);

  var on = _cluster["default"].on.bind(_cluster["default"]);

  (0, _master.master)(argv, fork, on);
} else {
  var processSend = process.send;

  if (processSend) {
    var _on = process.on.bind(process);

    var send = processSend.bind(process);
    (0, _worker.worker)(argv, _on, send)["catch"](function (err) {
      console.error(err);
      process.exit(1);
    });
  } else {
    throw new Error('Expected process.send to be defined');
  }
}