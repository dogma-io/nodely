# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

<!--
  The bumpr comment below is there to make it easier to update this changelog using a machine during PR merge.
  Please do not remove it, as this will break continuous integration.
-->

<!-- bumpr -->

## 1.0.0 (2019-10-26)

### Changed
*   CI to use `bumper` instead of `pr-bumper`
*   dependencies to latest versions

## 0.8.0 (2018-09-02)

### Changed
*   Dependencies to latest versions.

## 0.7.0 (2018-06-13)

### Changed
*   To latest dependencies which now uses latest version of Babel 7 alpha pacakges.

## 0.6.0 (2018-06-05)

### Changed
*   Default builds to target ES5 instead of Node 6.

## 0.5.1 (2018-05-28)

### Added
*   `@babel/core` back to dependencies to not break consumers.

## 0.5.0 (2018-05-28)

### Changed
*   Use `babel-preset-nodely` for config and Babel dependencies.

## 0.4.0 (2018-05-27)

### Changed
*   Babel to latest Babel 7 beta packages.

## 0.3.0 (2018-05-27)

### Changed
*   Stop using default exports as they provide no real benefit and can cause issues with tree-shaking.

## 0.2.1 (2018-05-27)

### Changed
*   Flow type so auto-generated Flow types won't break downstream projects using Flow.

## 0.2.0 (2018-05-25)

### Changed
*   Generate updated flow types.
*   Dependencies to latest versions.

## 0.1.6 (2018-05-16)

### Changed
*   Dependencies to latest versions.

## 0.1.5 (2018-05-10)

### Changed
*   `flow-bin` to latest version.

## 0.1.4 (2018-04-30)

### Changed
*   Dependencies to latest versions.

## 0.1.3 (2018-04-20)

### Changed
*   `flow-bin` to version `0.70.0`.

## 0.1.2 (2018-04-04)

### Changed
*   Babel to latest Babel 7 beta.

## 0.1.1 (2018-03-29)

### Changed
*   `flow-bin` to latest version.

## 0.1.0 (2018-03-19)

### Added
*   More logging when verbose flag is set and made sure to have better error handling around various potential failure points.

### Changed
*   Default Node target from 4 to 6 since 6 is the current LTS.
*   Minimum Node version to 6 which is the current LTS.
*   Flow type definitions to latest.
*   Dependencies to latest versions.
*   Lifted cluster and process methods out of master and worker so the code can eventually be run in a single process without clustering as well.

## 0.0.29 (2018-02-25)

### Changed
*   `flow-bin` to latest version.

## 0.0.28 (2018-02-13)

### Changed
*   Babel to latest Babel 7 alpha dependencies.

## 0.0.27 (2018-02-12)

### Changed
*   Dependencies to latest versions.

### Fixed
*   Issues with tests (were silently failing on previous version of Jest).

## 0.0.26 (2018-01-31)

### Changed
*   Dependencies to latest versions.

## 0.0.25 (2018-01-28)

### Added
*   `include` CLI argument to limit which files are transformed/copied.

## 0.0.24 (2018-01-26)

### Fixed
*   Include filename in babel transform config so plugins get filenames.

## 0.0.23 (2018-01-25)

### Added
*   When consumer defines a Babel configuration file, use theirs instead of default.

## 0.0.22 (2018-01-07)

### Changed
*   Babel to Babel 7 beta.

## 0.0.21 (2018-01-06)

### Changed
*   Dependencies to latest versions.

## 0.0.20 (2017-11-21)

### Fixed
*   Generated flow types.

## 0.0.19 (2017-11-21)

### Added
*   Flow typed all source code and generated Flow types in output directory.

## 0.0.18 (2017-11-21)

### Added
*   Jest configuration to fail if coverage drops below 100%.

## 0.0.17 (2017-11-21)

### Added
*   `target` CLI option to change target Node version.

## 0.0.16 (2017-11-18)

### Added
*   More tests to reach 100% code coverage.

### Fixed
*   Master to log errors rather than throw so it doesn't die under edge cases.

## 0.0.15 (2017-11-15)

### Added
*   [codecov](https://www.npmjs.com/package/codecov) package to handle publishing code coverage.
*   Partial test coverage of [master](src/master.js).

### Changed
*   To latest version of *lintly*.

## 0.0.14 (2017-11-14)

### Added
*   coverage badge to [README.md](README.md).

## 0.0.13 (2017-11-14)

### Added
*   npm badge to [README.md](README.md).

## 0.0.12 (2017-11-13)

### Added
*   [LICENSE.md](LICENSE.md).

## 0.0.11 (2017-11-13)

### Changed
*   `package.json` to limit what files are included in npm package.

## 0.0.10 (2017-11-13)

### Fixed
*   Output files to maintain same permissions as input files.

## 0.0.9 (2017-11-12)

### Added
*   Full test coverage for `worker.js`.

### Changed
*   *lintly* to version **0.0.2** to support using `beforeAll` and `afterAll` in tests.

## 0.0.8 (2017-11-09)

### Added

*   Code coverage.
*   Tests for worker file removal code.

### Changed
*   From *babel-preset-es2015* to *babel-preset-env* to fix warning and explicitly target Node 4, which is in maintenance LTS, with output.
*   *flow-bin* to latest version, 0.59.0.

## 0.0.7 (2017-11-08)

### Changed
*   Switched to using [lintly](https://github.com/dogma-io/lintly) for linting to reduce boilerplate in this repo.

### Fixed
*   Broken tests.

## 0.0.6 (2017-11-08)

### Changed
*   Keywords in `package.json` as they didn't align with project's functionality.

## 0.0.5 (2017-10-30)

### Fixed
*   Handle remaining worker errors properly to prevent master process from never finishing.

## 0.0.4 (2017-10-30)

### Fixed
*   When any files fail to process make sure master process exist with non-zero status code.

## 0.0.3 (2017-10-30)

### Fixed
*   Do a better job handling errors so workers don't all get into non-idle state where files can't finish processing.

## 0.0.2 (2017-10-30)

### Changed
*   Use babel react preset instead of flowtype plugin in order to handle JSX as well.

## 0.0.1 (2017-10-30)

### Added
*   Initial implementation.
