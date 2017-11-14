# nodely [![NPM][npm-img]][npm-url] [![Coverage][cov-img]][cov-url]

Write Node code using whatever syntax you want.

## Installation

**npm**

```bash
npm install nodely
```

**yarn**

```bash
yarn add nodely
```

## Usage

The most basic usage is achieved with the following command, replacing the source path with the path to your source code to transform and the output path with the path to where you want the transformed code to be written.

```bash
nodely -s ./path/to/source -o ./path/to/output
```

### Options

**Verbose**

By default nodely will inform you when files fail to transform but won't provide much detail. If you want entire stack-traces when the failures occur you can use the `-v` flag like so:

```bash
nodely -s ./path/to/source -o ./path/to/output -v
```

**Watcher**

If you want to leave the nodely server running and have it transform modified files on the fly then you simply need to add the `-w` flag like so:

```bash
nodely -s ./path/to/source -o ./path/to/output -w
```

**Workers**

By default the server will spawn a worker process for all but one CPU, reserving the last CPU for the master process. If you want to spawn less workers you can use the `-n` flag like so:

```bash
nodely -s ./path/to/source -o ./path/to/output -n 3 # This will spawn 3 workers
```

[cov-img]: https://img.shields.io/codecov/c/github/dogma-io/nodely.svg "Code Coverage"
[cov-url]: https://codecov.io/gh/dogma-io/nodely

[npm-img]: https://img.shields.io/npm/v/nodely.svg "NPM Version"
[npm-url]: https://www.npmjs.com/package/nodely
