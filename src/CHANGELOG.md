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
