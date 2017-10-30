#! /usr/bin/env node
'use strict';

var _cluster = require('cluster');

var _cluster2 = _interopRequireDefault(_cluster);

var _yargs = require('yargs');

var _yargs2 = _interopRequireDefault(_yargs);

var _master = require('./master');

var _master2 = _interopRequireDefault(_master);

var _worker = require('./worker');

var _worker2 = _interopRequireDefault(_worker);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var argv = _yargs2.default.option('output', {
  alias: 'o',
  demandOption: true,
  description: 'Directory where transformed code should be output.',
  type: 'string'
}).option('source', {
  alias: 's',
  demandOption: true,
  description: 'Directory containing source code to transform.',
  type: 'string'
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
}).option('verbose', {
  alias: 'v',
  default: false,
  description: 'Whether or not to have verbose logging.',
  type: 'boolean'
}).argv;

// TODO: verify source directory exists

if (_cluster2.default.isMaster) {
  (0, _master2.default)(argv);
} else {
  (0, _worker2.default)(argv);
}