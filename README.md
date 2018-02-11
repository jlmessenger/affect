# Affect
Affect is a micro abstraction layer for Javascript that simplifies unit testing and monitoring side-effects.

#### Project Goals
* Easy to learn - pure functional Javascript
* Enable fast and painless unit testing
* Simple interop with existing code and patterns
* Lightweight and low-impact, only ~460bytes gzipped, even smaller minified

#### Setup
```sh
npm install --save affect
```

#### Contents
 * [Writing Affect Methods](#writing-affect-methods)
 * [Call Interfaces](#call-interfaces)
 * [Simple Unit Testing](#simple-unit-testing)
   * [affectTest Interface](#affecttest-interface)
   * [Promise.all Unit Test](#promiseall-unit-test-example)
 * [Using Affect Methods](#using-affect-methods)
   * [affect Interface](#affect-interface)
 * [Notes on Promises](#notes-on-promises)
   * [BYO Promise](#byo-promise)

## Writing Affect Methods
Writing an affect method is the same as writing any normal Javascript promise/async function,
except the first argument will always be `call`.

Then within the method, any methods which loads state or causes side-effects should not be called
directly, but rather called using the passed-in `call` interface.

#### Affect Method Example
```js
// Promise style
function getUser(call, userId) {
  return call.async(queryDatabase, `SELECT * FROM users WHERE userId = ${userId}`)
    .then(({rows}) => {
      if (rows.length === 0) {
        throw new NotFoundError('User not found');
      }
      return rows[0];
    });
}
```
```js
// Async/Await style
async function getUser(call, userId) {
  const rows = await call.async(queryDatabase, `SELECT * FROM users WHERE userId = ${userId}`);
  if (rows.length === 0) {
    throw new NotFoundError('User not found');
  }
  return rows[0];
}
```

## Call Interfaces
* `call(fn, ...args) : Promise` - Call another affect-style method.
* `call.plain(fn, ...args) : result` - Call an normal javascript function.
* `call.sync(fn, ...args) : result` - Alias for _call.plain()_.
* `call.bound(instance, 'methodName', ...args) : result` - Call a method on the specified instance.
* `call.fromCb(fn, ...args) : Promise(result)` - Call a function which uses a node-style _callback(err, result)_.
* `call.multiCb(fn, ...args) : Promise([...results])` - Call a function which uses a node-style _callback(err, result1, result2)_.

#### Call Interface Example
This example demonstrates a variety of the `call` interfaces in a single affect method.

The method is designed to make an HTTP GET request to a uri stored in a JSON config file
and include the current unix epoch as a query string param.

```js
// Promise style
function sendTime(call) {
  const unixEpoch = Math.floor(call.sync(Date.now) / 1000);
  return call.fromCb(fs.readFile, '/path/to/config.json')
    .then(JSON.parse)
    .then(config => call.plain(fetch, `${config.url}?time=${unixEpoch}`))
    .then(response => call.plain(response.json));
}
```
```js
// async/await style
async function sendTime(call) {
  const unixEpoch = Math.floor(call.sync(Date.now) / 1000);
  const config = JSON.parse(await call.fromCb(fs.readFile, '/path/to/config.json'));
  const response = await call.plain(fetch, `${config.url}?time=${unixEpoch}`);
  return await call.plain(response.json);
}
```

## Simple Unit Testing
You've now learned how simple it is to write an affect method using the `call` interfaces.
However, the real advantage of making those small changes becomes clear when writing unit tests.

Let's expand the call interface example from before to include additional error handling logic.

```js
async function sentTime(call) {
  const unixEpoch = Math.floor(call.sync(Date.now) / 1000);
  try {
    const config = JSON.parse(await call.fromCb(fs.readFile, '/path/to/config.json'));
  } catch (err) {
    throw new InvalidConfigError(`Unable to read config file: ${err.message}`);
  }
  const response = await call.plain(fetch, `${config.url}?time=${unixEpoch}`);
  if (!response.ok) {
    throw new HttpCallFailure(`HTTP Error ${response.status}`);
  }
  return await call.plain(response.json);
}
```

Normally getting full unit-test coverage on this function would require many mocks, often provided by a tool like Sinon.
With Affect, unit tests are as simple as describing each intended call with arguments and the final method outcome.

#### Unit Test Example

```js
// Example assumes mocha or jest style tests - but any test-runner will work.
// Also assumes all other referenced functions have already been imported/required.
const affectTest = require('affect/test');
describe('sentTime()', () => {
  it('works on happy-path', () =>
    affectTest(sentTime)
      .args()
      .calls(Date.now)
      .callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json')
      .callResolves('{"url":"http://example.com"}')
      .calls(fetch, 'http://example.com?time=151536439')
      .callResolves(new Response(new Blob('{"ok":true}'), {status: 200}))
      .expectsReturn({ok: true})
  );
  it('converts error if config not found', () =>
    affectTest(sentTime)
      .args()
      .calls(Date.now)
      .callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json')
      .callThrows(new Error('Not Found'))
      .expectsThrow(new InvalidConfigError('Unable to read config file: Not Found'))
  );
  it('converts error if config invalid JSON', () =>
    affectTest(sentTime).args()
      .calls(Date.now).callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json')
      .callResolves('bad-json')
      .expectsThrow(new InvalidConfigError('Unable to read config file: Unexpected token b in JSON at position 0'))
  );
  it('passes thru fetch failure', () =>
    affectTest(sentTime).args()
      .calls(Date.now)
      .callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json')
      .callReturns('{"url":"http://example.com"}')
      .calls(fetch, 'http://example.com?time=151536439')
      .callRejects(new Error('passed-thru'))
      .expectsThrow(new Error('passed-thru'))
  );
  it('fails on non 2xx responses', () =>
    affectTest(sentTime).args()
      .calls(Date.now)
      .callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json')
      .callResolves('{"url":"http://example.com"}')
      .calls(fetch, 'http://example.com?time=151536439')
      .callResolves(new Response(new Blob('{"ok":false}'), {status: 500}))
      .expectsThrow(new HttpCallFailure(`HTTP Error 500`))
  );
});
```

### affectTest Interface
The `affectTest` method creates a new test chain which you can use to describe the expected calls, and mock their outputs.

The test chain always starts with `affectTest(fn).args(arg1, arg2)` and ends with `.expectsThrow(error)` or `.expectsReturn(data)`.
In between you add as many `.calls(fn, ...args).callReturns(mockData)`, `.calls(fn, ...args).callThrows(mockError)`
or `.callsAll([...])` entries as needed to describe all the methods directly called by the affect method being tested.

Below is a detailed description of the test chain methods:

* `affectTest(fn)`  
  Creates a new test chain for the specified affect method `fn`.  
  Must be followed by `.args()`.
* `.args(arg1, arg2, ...)`  
  Passes the provided arguments into the affect method being tested.  
  Must be followed by `.calls()` or `.callsBound()`.
* `.calls(expectedFn, expectedArg1, expectedArg2, ...)`  
  Asserts that the affect method being tested calls the function `expectedFn` with the provided arguments.
  Arguments are compared with `assert.deepStrictEqual`.  
  Must be followed be either `.callReturns()`, `.callThrows()`, `.callResolves()` or `.callRejects()`.
* `.callReturns(data)`  
  Defines the mock data to return for the call.  
  Must be followed be either another `.calls()` or `.callsBound()`
  or the test chain can be ended with `.expectsReturn()`, `.expectsThrow()` or `.run()`.
* `.callThrows(error)`  
  Defines the mock error instance to throw for the call.  
  Must be followed be either another `.calls()` or `.callsBound()`
  or the test chain can be ended with `.expectsReturn()`, `.expectsThrow()` or `.run()`.
* `.callResolves(data)`  
  Defines the mock data to resolve as a Promise for the call.  
  Must be followed be either another `.calls()` or `.callsBound()`
  or the test chain can be ended with `.expectsReturn()`, `.expectsThrow()` or `.run()`.
* `.callRejects(error)`  
  Defines the mock error instance to reject as a Promise for the call.  
  Must be followed be either another `.calls()` or `.callsBound()`
  or the test chain can be ended with `.expectsReturn()`, `.expectsThrow()` or `.run()`.
* `.expectsReturn(data)`  
  Asserts that the affect method being tested resolves the specified data.  
  Data is compared using `assert.deepStrictEqual`.  
  Return a `Promise` that resolves when the test has passed, or rejects with a test failure.
* `.expectsThrow(error)`  
  Asserts that the affect method being tested rejects the specified error.
  Error instances are asserted to be the same type and have the same error message.
  Non-error objects are simply compared for deep equality.  
  Returns a `Promise` that resolves when the test has passed, or rejects with a test failure.
* `.run()`
  Run the test chain with no assertion, returning a Promise. 
  The Promise will resolve/reject with the outcome of the method,
  or reject with any _affectTest_ validation errors.  
  Can be useful for providing custom validation on the test result. 

#### Promise.all Unit Test Example
Suppose an affect method makes a group of calls in parallel using `Promise.all()`.
These parallel calls can be easily tested using `.awaitsAllCalls`

```js
// Method to be tested
function concatFiles(call, ...filePaths) {
  const parallelReads = filePaths.map(filePath => call.fromCb(fs.readFile, filePath));
  return Promise.all(parallelReads)
    .then(allFiles => allFiles.join('\n'));
}
```

```js
// Unit test example
describe('concatFiles()', () => {
  it('will combine all files', () => {
    // human readable
    const mockFiles = {
      'a.txt': 'first\nfile',
      'b.txt': 'second\nfile',
      'c.txt': 'third'
    };
    return affectTest(concatFiles).args(...mockFileNames)
      .calls(fs.readFile, 'a.txt)
      .callResolves(mockFiles['a.txt'])
      .calls(fs.readFile, 'b.txt)
      .callResolves(mockFiles['b.txt'])
      .calls(fs.readFile, 'c.txt)
      .callResolves(mockFiles['c.txt'])
      .expectsReturn('first\nfile\nsecond\nfile\nthird');
  });
});
```

### Test Runners
Affect has been written to use node's native `assert` methods.

Any test runner which supports promises as reject = fail, resolve = pass should work with `affectTest()`.

## Using Affect Methods
You've now seen how easy it is to write methods in the affect style, and how that simplifies unit testing.
But how do you use these methods in normal code?

### affect Interface
To make an affect style method available to the rest of your code, you need to convert it to a regular function.
This is done by using `affect`.

```js
const affect = require('affect');
const getUser = require('./methods/get-user');
const concatFiles = require('./methods/concat-files');
const sendTime = require('./methods/send-time');
const functions = affect({
  getUser,
  concatFiles,
  sendTime
});
module.exports = functions;
```

The above code imports/requires each method that you need to call directly, and then exports it without the call argument.
You can now simply use each function without worrying about `call` argument. Examples:

* `functions.getUser(userId)`
* `functions.concatFiles(...filePaths)`
* `functions.sendTime()`

You can also organize your functions into namespaces using nested objects.

```js
const affect = require('affect');
const getUser = require('./methods/get-user');
const concatFiles = require('./methods/concat-files');
const sendTime = require('./methods/send-time');
const functions = affect({
  user: {
    get: getUser
  },
  io: {
    files: {
      concat: concatFiles
    },
    http: {
      sendTime
    }
  }
});
module.exports = functions;
```

In this version the functions would be available using:

* `functions.user.get(userId)`
* `functions.io.files.concat(...filePaths)`
* `functions.io.http.sendTime()`

## Notes on Promises
By default all Affect functions and tests will return whatever global `Promise` object is defined in the environment. For older browsers remember to include your favorite shim.

### BYO Promise
Affect can use your favorite promise library in Affect by assigning it to `affect.Promise`. Just ensure you assign it before using `affect()` or `affectTest()`.

```js
const affect = require('affect');
const Bluebird = require('bluebird');
affect.Promise = Bluebird;
```
