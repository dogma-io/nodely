# nodely [![NPM][npm-img]][npm-url] [![Coverage][cov-img]][cov-url]

Write Node code using whatever syntax you want.

## Table of Contents

*   [Installation](#installation)
*   [Documentation](#documentation)
*   [Code of Conduct](#code-of-conduct)
*   [Contributing](#contributing)
*   [License](#license)

## Installation

**npm**

```bash
npm install nodely
```

**yarn**

```bash
yarn add nodely
```

## Documentation

The most basic usage is achieved with the following command, replacing the source path with the path to your source code to transform and the output path with the path to where you want the transformed code to be written.

```bash
nodely -s ./path/to/source -o ./path/to/output
```

> NOTE: If you have a `.babelrc.js` or `.babelrc.json` configuration file for Babel, *nodely* will use that instead of it's own built-in configuration. It's built-in configuration supports ES6, Flow types, and React.

### Options

**Include**

By default Nodely will copy/transform all files from the source directory into the output directory. However if you want to limit which files are copied/transformed you can provide a regular expression to match included files against.

```bash
nodely -s ./path/to/source -o ./path/to/output -i "\.js$"
```

> Note: In the above example only Javascript files will be transformed into the output directory.

**Target**

By default Nodely outputs code in ES5 which should work for both Node and browsers (as long as you aren't using target specific API's such as `fs`). If you'd like your build to target a specific Node version you can set the target like so:

```bash
nodely -s ./path/to/source -o ./path/to/output -t 8
```

> Note: This option will have no effect if you have your own Babel configuration defined, this only applies when you are relying on *nodely*'s built-in configuration.

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

## Code of Conduct

Please see the [code of conduct](CODE_OF_CONDUCT.md).

## Contributing

Please see the [contributing guide](CONTRIBUTING.md).

## License

[MIT](LICENSE.md)

[cov-img]: https://img.shields.io/codecov/c/github/dogma-io/nodely.svg "Code Coverage"
[cov-url]: https://codecov.io/gh/dogma-io/nodely

[npm-img]: https://img.shields.io/npm/v/nodely.svg "NPM Version"
[npm-url]: https://www.npmjs.com/package/nodely
