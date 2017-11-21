** 0.0.20

*   Fixed generated flow types.

** 0.0.19

*   Flow typed all source code and generated Flow types in output directory.

## 0.0.18

*   Added Jest configuration to fail if coverage drops below 100%.

## 0.0.17

*   Added `target` CLI option to change target Node version.

## 0.0.16

*   Added more tests to reach 100% code coverage.
*   Improved master to log errors rather than throw so it doesn't die under edge cases.

## 0.0.15

*   Added [codecov](https://www.npmjs.com/package/codecov) package to handle publishing code coverage.
*   Added partial test coverage of [master](src/master.js).
*   Upgraded to latest version of *lintly*.

## 0.0.14

*   Added coverage badge to [README.md](README.md).

## 0.0.13

*   Added npm badge to [README.md](README.md).

## 0.0.12

*   Added [LICENSE.md](LICENSE.md).

## 0.0.11

*   Update `package.json` to limit what files are included in npm package.

## 0.0.10

### Bug Fixes

*   Fixed output files to maintain same permissions as input files.

## 0.0.9

*   Added full test coverage for `worker.js`.
*   Upgraded *lintly* to version **0.0.2** to support using `beforeAll` and `afterAll` in tests.

## 0.0.8

*   Added code coverage.
*   Added tests for worker file removal code.
*   Switched from *babel-preset-es2015* to *babel-preset-env* to fix warning and explicitly target Node 4, which is in maintenance LTS, with output.
*   Upgraded *flow-bin* to latest version, 0.59.0.

## 0.0.7

*   Fixed broken tests.
*   Switched to using [lintly](https://github.com/dogma-io/lintly) for linting to reduce boilerplate in this repo.

## 0.0.6

*   Updated keywords in `package.json` as they didn't align with project's functionality.

## 0.0.5

### Bug Fixes

*   Handle remaining worker errors properly to prevent master process from never finishing.

## 0.0.4

### Bug Fixes

*   When any files fail to process make sure master process exist with non-zero status code.

## 0.0.3

### Bug Fixes

*   Do a better job handling errors so workers don't all get into non-idle state where files can't finish processing.

## 0.0.2

### Features

*   Use babel react preset instead of flowtype plugin in order to handle JSX as well.

## 0.0.1

*   Initial implementation.
