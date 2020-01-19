# 1.0.0 (2019-10-26)

*   **Changed** CI to use `bumper` instead of `pr-bumper`
*   **Changed** dependencies to latest versions

# 0.8.0 (2018-09-02)

*   Upgrade dependencies to latest versions.


# 0.7.0 (2018-06-13)

*   Upgrade to latest dependencies which now uses latest version of Babel 7 alpha pacakges.


# 0.6.0 (2018-06-05)

*   Change default builds to target ES5 instead of Node 6.

# 0.5.1 (2018-05-28)

*   Add `@babel/core` back to dependencies to not break consumers.


# 0.5.0 (2018-05-28)

*   Use `babel-preset-nodely` for config and Babel dependencies.


# 0.4.0 (2018-05-27)

*   Upgrade to latest Babel 7 beta packages.

# 0.3.0 (2018-05-27)

*   Stop using default exports as they provide no real benefit and can cause issues with tree-shaking.

# 0.2.1 (2018-05-27)

*   Change Flow type so auto-generated Flow types won't break downstream projects using Flow.


# 0.2.0 (2018-05-25)

*   Generate updated flow types.
*   Update dependencies to latest versions.


# 0.1.6 (2018-05-16)

*   Upgrade dependencies to latest versions.

# 0.1.5 (2018-05-10)

*   Upgrade `flow-bin` to latest version.


# 0.1.4 (2018-04-30)

*   Upgrade dependencies to latest versions.


# 0.1.3 (2018-04-20)

*   Upgrading to version `0.70.0` of `flow-bin`.


# 0.1.2 (2018-04-04)

*   Upgraded to latest Babel 7 beta.


# 0.1.1 (2018-03-29)

*   Upgraded `flow-bin` to latest version.

# 0.1.0 (2018-03-19)

*   Changed default Node target from 4 to 6 since 6 is the current LTS.
*   Changed minimum Node version to 6 which is the current LTS.
*   Updated flow type definitions.
*   Updated dependencies to latest versions.
*   Lifted cluster and process methods out of master and worker so the code can eventually be run in a single process without clustering as well.
*   Added more logging when verbose flag is set and made sure to have better error handling around various potential failure points.


# 0.0.29 (2018-02-25)

*   Upgrade to latest version of `flow-bin`.

# 0.0.28 (2018-02-13)

*   Upgrade to latest Babel 7 alpha dependencies.

# 0.0.27 (2018-02-12)

*   Upgrade dependencies to latest versions.
*   Fix issues with tests (were silently failing on previous version of Jest).

# 0.0.26 (2018-01-31)

*   Upgrade dependencies to latest versions.

# 0.0.25 (2018-01-28)

## Features

*   Added `include` CLI argument to limit which files are transformed/copied.

# 0.0.24 (2018-01-26)

## Bug Fixes

*   Include filename in babel transform config so plugins get filenames.

# 0.0.23 (2018-01-25)

## Features

*   When consumer defines a Babel configuration file, use theirs instead of default.

# 0.0.22 (2018-01-07)

*   Upgrade to Babel 7 beta.

# 0.0.21 (2018-01-06)

*   Updated dependencies.

# 0.0.20 (2017-11-21)

*   Fixed generated flow types.

# 0.0.19 (2017-11-21)

*   Flow typed all source code and generated Flow types in output directory.

# 0.0.18 (2017-11-21)

*   Added Jest configuration to fail if coverage drops below 100%.

# 0.0.17 (2017-11-21)

## Features

*   Added `target` CLI option to change target Node version.

# 0.0.16 (2017-11-18)

*   Added more tests to reach 100% code coverage.

## Bug Fixes

*   Improved master to log errors rather than throw so it doesn't die under edge cases.

# 0.0.15 (2017-11-15)

*   Added [codecov](https://www.npmjs.com/package/codecov) package to handle publishing code coverage.
*   Added partial test coverage of [master](src/master.js).
*   Upgraded to latest version of *lintly*.

# 0.0.14 (2017-11-14)

*   Added coverage badge to [README.md](README.md).

# 0.0.13 (2017-11-14)

*   Added npm badge to [README.md](README.md).

# 0.0.12 (2017-11-13)

*   Added [LICENSE.md](LICENSE.md).

# 0.0.11 (2017-11-13)

*   Update `package.json` to limit what files are included in npm package.

# 0.0.10 (2017-11-13)

## Bug Fixes

*   Fixed output files to maintain same permissions as input files.

# 0.0.9 (2017-11-12)

*   Added full test coverage for `worker.js`.
*   Upgraded *lintly* to version **0.0.2** to support using `beforeAll` and `afterAll` in tests.

# 0.0.8 (2017-11-09)

*   Added code coverage.
*   Added tests for worker file removal code.
*   Switched from *babel-preset-es2015* to *babel-preset-env* to fix warning and explicitly target Node 4, which is in maintenance LTS, with output.
*   Upgraded *flow-bin* to latest version, 0.59.0.

# 0.0.7 (2017-11-08)

*   Fixed broken tests.
*   Switched to using [lintly](https://github.com/dogma-io/lintly) for linting to reduce boilerplate in this repo.

# 0.0.6 (2017-11-08)

*   Updated keywords in `package.json` as they didn't align with project's functionality.

# 0.0.5 (2017-10-30)

## Bug Fixes

*   Handle remaining worker errors properly to prevent master process from never finishing.

# 0.0.4 (2017-10-30)

## Bug Fixes

*   When any files fail to process make sure master process exist with non-zero status code.

# 0.0.3 (2017-10-30)

## Bug Fixes

*   Do a better job handling errors so workers don't all get into non-idle state where files can't finish processing.

# 0.0.2 (2017-10-30)

## Features

*   Use babel react preset instead of flowtype plugin in order to handle JSX as well.

# 0.0.1 (2017-10-30)

*   Initial implementation.
