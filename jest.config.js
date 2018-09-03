/* eslint-disable comma-dangle, prettier/prettier */

module.exports = {
  collectCoverage: true,
  collectCoverageFrom: ['src/**/*.js'],
  coverageReporters: ['json-summary', 'lcov'],
  coverageThreshold: {
    global: {
      branches: 98.26,
      functions: 100,
      lines: 99.15,
      statements: 99.15,
    }
  },
  snapshotSerializers: ['jest-serializer-path'],
  testRegex: '/__tests__/.*-test\\.js$'
}
