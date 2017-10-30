#! /usr/bin/env node

import cluster from 'cluster'
import yargs from 'yargs'
import master from './master'
import worker from './worker'

const argv = yargs
  .option('output', {
    alias: 'o',
    demandOption: true,
    description: 'Directory where transformed code should be output.',
    type: 'string',
  })
  .option('source', {
    alias: 's',
    demandOption: true,
    description: 'Directory containing source code to transform.',
    type: 'string',
  })
  .option('verbose', {
    alias: 'v',
    default: false,
    description: 'Whether or not to have verbose logging.',
    type: 'boolean',
  })
  .option('watch', {
    alias: 'w',
    default: false,
    description:
      'Whether or not to watch for changes and continue transpiling.',
    type: 'boolean',
  })
  .option('workerCount', {
    alias: 'n',
    default: 0,
    description: 'Number of worker process to spawn.',
    type: 'number',
  }).argv

// TODO: verify source directory exists

if (cluster.isMaster) {
  master(argv)
} else {
  worker(argv)
}
