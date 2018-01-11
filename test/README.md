# Affect Unit Tests
Affect is written using module syntax and some ES2017 features. Unfortunately module loading is still incomplete in node, and encounters many problems when instrumenting for coverage.

Since affect is designed to be seamless between test runners, both Mocha and Jest are used to run internal unit tests.

## Jest
Uses babel to instrument on-the-fly transpiled `src/*.mjs` files.

**Ensures**

 * Source ES2017 code works
 * Jest `expect` based assertions works

## Mocha
Uses the output code and sourcemaps in `dist/*.js` as produced by rollup & buble.

**Ensures**

 * Compiled UMD library works when used as CommonJS
 * Loading of node's internal `assert` library works
