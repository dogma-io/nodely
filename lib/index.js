#! /usr/bin/env node
"use strict";

var _cluster = _interopRequireDefault(require("cluster"));

var _yargs = _interopRequireDefault(require("yargs"));

var _master = _interopRequireDefault(require("./master"));

var _worker = _interopRequireDefault(require("./worker"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var argv = _yargs.default.option('output', {
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
  default: '4',
  description: 'Target Node version.',
  type: 'string'
}).option('verbose', {
  alias: 'v',
  default: false,
  description: 'Whether or not to have verbose logging.',
  type: 'boolean'
}).option('watch', {
  alias: 'w',
  default: false,
  description: 'Whether or not to watch for changes and continue transpiling.',
  type: 'boolean'
}).option('workerCount', {
  alias: 'n',
  default: 0,
  description: 'Number of worker process to spawn.',
  type: 'number'
}).argv; // TODO: verify source directory exists


if (_cluster.default.isMaster) {
  (0, _master.default)(argv);
} else {
  (0, _worker.default)(argv);
}