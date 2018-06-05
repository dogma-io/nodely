#! /usr/bin/env node

/**
 * @flow
 */

import cluster from 'cluster'
import yargs from 'yargs'
import {master} from './master'
import type {Argv} from './types'
import {worker} from './worker'

const argv: Argv = (yargs
  .option('include', {
    alias: 'i',
    description: 'Only include files matching this regex.',
    type: 'string',
  })
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
  .option('target', {
    alias: 't',
    description: 'Target Node version.',
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
  }).argv: any) // eslint-disable-line

// TODO: verify source directory exists

if (cluster.isMaster) {
  const fork = cluster.fork.bind(cluster)
  const on = cluster.on.bind(cluster)
  master(argv, fork, on)
} else {
  const processSend = process.send

  if (processSend) {
    const on = process.on.bind(process)
    const send = processSend.bind(process)
    worker(argv, on, send).catch((err: Error) => {
      console.error(err)
      process.exit(1)
    })
  } else {
    throw new Error('Expected process.send to be defined')
  }
}
