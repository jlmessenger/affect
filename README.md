# Affect
Affect is a micro abstraction layer for Javascript that simplifies unit testing and monitoring side-effects.

#### Project Goals
* Easy to learn - pure functional Javascript
* Enable fast and painless unit testing
* Simple interop with existing code and patterns
* Lightweight and low-impact

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
   * [Controlled Execution Tests](#controlled-execution-tests)
 * [Using Affect Methods](#using-affect-methods)
   * [affect Interface](#affect-interface)
   * [Getting Telemetry](#getting-telemetry)
   * [Using Context](#using-context)
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
* `call.plain(fn, ...args) : Promise(result)` - Call an async function or a function which returns a Promise.
* `call.sync(fn, ...args) : result` - Call a synchronous Javascript function.
* `call.fromCb(fn, ...args) : Promise(result)` - Call a function which uses a node-style callback(err, result).
* `call.multiCb(fn, ...args) : Promise([...results])` - Call a function which uses a node-style callback(err, result1, result2).
* `call.bound(instance, 'methodName', ...args) : Promise(result)` - Call a method on the specified instance.
* `call.context : Object` - Reference to the context object

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
    affectTest(sentTime).args()
      .calls(Date.now)
        .callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json')
        .callReturns('{"url":"http://example.com"}')
      .calls(fetch, 'http://example.com?time=151536439')
        .callReturns(new Response(new Blob('{"ok":true}'), {status: 200}))
      .expectsReturn({ok: true})
  );
  it('converts error if config not found', () =>
    affectTest(sentTime).args()
      .calls(Date.now).callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json').callThrows(new Error('Not Found'))
      .expectsThrow(new InvalidConfigError('Unable to read config file: Not Found'))
  );
  it('converts error if config invalid JSON', () =>
    affectTest(sentTime).args()
      .calls(Date.now).callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json').callReturns('bad-json')
      .expectsThrow(new InvalidConfigError('Unable to read config file: Unexpected token b in JSON at position 0'))
  );
  it('passes thru fetch failure', () =>
    affectTest(sentTime).args()
      .calls(Date.now).callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json').callReturns('{"url":"http://example.com"}')
      .calls(fetch, 'http://example.com?time=151536439').callThrows(new Error('passed-thru'))
      .expectsThrow(new Error('passed-thru'))
  );
  it('fails on non 2xx responses', () =>
    affectTest(sentTime).args()
      .calls(Date.now)
        .callReturns(1515364390001)
      .calls(fs.readFile, '/path/to/config.json')
        .callReturns('{"url":"http://example.com"}')
      .calls(fetch, 'http://example.com?time=151536439')
        .callReturns(new Response(new Blob('{"ok":false}'), {status: 500}))
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

* `affectTest(fn, config)`  
  Creates a new test chain for the specified affect method `fn`.  
  Must be followed by `.args()`.
  
  `config` is an optional object with the following properties:  
  * `context` - context object
  * `onFunction` - event handler called when before `fn` is executed
  * `onCall` - event handler called when before each mock is executed
  * `onCallComplete` - event handler called after each mock is executed
  * `onFunctionComplete` - event handler called after `fn` is executed
* `.args(arg1, arg2, ...)`  
  Passes the provided arguments into the affect method being tested.  
  Must be followed by `.calls()` or `.callsAll()`.
* `.calls(expectedFn, expectedArg1, expectedArg2, ...)`  
  Asserts that the affect method being tested calls the function `expectedFn` with the provided arguments.
  Arguments are compared with `assert.deepStrictEqual`.  
  If any arguments are dynamic functions, like `call(doX, x => x + 1)`, then in there is no way to
  directly assert them. In that case use: `.calls(doX, Function)` and it will only assert that the argument
  is a function.  
  Must be followed be either `.callReturns()` or `.callThrows()`.
* `.callReturns(data)`  
  Defines the mock data to return/resolve for the call.  
  Must be followed be either another `.calls()` or `.callsAll()`
  or the test chain can be ended with `.expectsReturn()` or `.expectsThrow()`.
* `.callThrows(error)`  
  Defines the mock error instance to throw/reject for the call.  
  Must be followed be either another `.calls()` or `.callsAll()`
  or the test chain can be ended with `.expectsReturn()` or `.expectsThrow()`.
* `.callExecute()`  
  Instructs the test to execute this call.  
  If the call makes calls of it's own, those calls will need to be specified in the test chain.
  See the section on [controlled execution](#controlled-execution-tests) for additional examples.
* `.callsAll(CallMocks[])`  
  Define a bulk set of calls as an array of CallMock objects. This is especially useful when the
  affect method being tested uses `Promise.all()` to execute calls in parallel.  
  Must be followed be either another `.calls()` or `.callsAll()`
  or the test chain can be ended with `.expectsReturn()` or `.expectsThrow()`.
  Each `CallMock` object must have the following properties:  
  * `fn` the expected function
  * `args` the expected arguments passed the `fn`
  * `success` boolean, set to false and mock will throw/reject the `result`
  * `result` the mock data to return or throw
* `.expectsReturn(data)`  
  Asserts that the affect method being tested returns the specified data.  
  Data is compared using `assert.deepStrictEqual`.  
  Return a `Promise` that resolves when the test has passed, or rejects with a test failure.
* `.expectsThrow(error)`  
  Asserts that the affect method being tested throws the specified error.
  Error instances are asserted to be the same type and have the same error message.
  Non-error objects are simply compared for deep equality.  
  Returns a `Promise` that resolves when the test has passed, or rejects with a test failure.

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
    // convert to CallMock object
    const mockFileNames = Object.keys(mockFiles);
    const mockReadCalls = mockFileNames.map(filePath => (
      { fn: fs.readFile, args: [filePath], success: true, result: mockFiles[filePath] }
    ));
    return affectTest(concatFiles).args(...mockFileNames)
      .callsAll(mockReadCalls)
      .expectsReturn('first\nfile\nsecond\nfile\nthird');
  });
});
```

#### Controlled Execution Tests
There are cases where rather than provide mock data for a unit test call, you want to execute the function.
This can be done using `.calls(action, arg1).callExecute()`. However, because the call is executed, any calls
that it makes will also need to be included in the test chain.

```js
// Example of database changes run within a transaction
function commit(call, tx) {
  return tx.call();
}
function rollback(call, tx) {
  return tx.rollback();
}

async function inTransaction(call, fnUsesTx) {
  const tx = await call(beginTransaction);
  try {
    const result = await fnUsesTx(tx);
    await call(commit, tx);
    return result;
  } catch (ex) {
    await call(rollback, tx);
    throw ex;
  }
}

async function updateMany(call, ids, values) {
  return await call(inTransaction, tx => {
    const updates = ids.map(id => call(updateItem, id, values, tx));
    return Promise.all(updates);
  });
}
```

In the above example, we want to ensure the transaction callback function is run during the test chain.
This can be accomplished using controlled execution as show below.

```js
const affectTest = require('affect/test');
describe('updateMany()', () => {
  it('will commit all updates', () => {
    const mockTx = { mock: true };
    const values = { fieldName: 'value' };
    return affectTest(updateMany)
      .args([1, 2], values)
      .calls(inTransaction, Function).callExecute()
      .calls(beginTransaction).callReturns(mockTx)
      .calls(updateItem, 1, values, mockTx).callReturns({ id: 1 })
      .calls(updateItem, 2, values, mockTx).callReturns({ id: 2 })
      .calls(commit, mockTx).callReturns()
      .expectsReturn([{ id: 1 }, { id: 2 }]);
  });
  it('will rollback on failure', () => {
    const mockTx = { mock: true };
    const values = { fieldName: 'other' };
    return affectTest(updateMany)
      .args([3, 4], values)
      .calls(inTransaction, Function).callExecute()
      .calls(beginTransaction).callReturns(mockTx)
      .calls(updateItem, 3, values, mockTx).callReturns({ id: 1 })
      .calls(updateItem, 4, values, mockTx).callThrows(new Error('Mock DB Error'))
      .calls(rollback, mockTx).callReturns()
      .expectsThrow(new Error('Mock DB Error'));
  });
});
```

As demonstrated in the above unit test examples, the dynamic function argument passed to `inTransaction`
is represented with placeholder `Function`. Then the `.callExecute()` command tells the test runner
that `inTransaction` should actually be run. The immediate `.calls` after the execution represent
the calls made from within the `inTransaction` method.

Finally after `inTransaction` begins the transaction, it runs the passed in function, which in turn
calls `updateItem`. After the updates are completed the `inTransaction` method calls commit.

**Other Benefits**  
In addition to running dynamic functions, controlled execution can also be useful to observe
full function execution, while asserting the specific call order and arguments made during execution.

**Alternative**  
The disadvantage of using controlled execution, is that you must repeat the sub-call logic in each test,
which means future refactoring will require changes to every test.

An alternative pattern that avoids dynamic functions may be preferred for this reason.

```js
async function inTransaction(call, subCalls) {
  const tx = call(beginTransaction);
  try {
    const runs = subCalls.map(({ fn, args = [] }) => call(fn, ...args.concat(tx)));
    return result = await Promise.all(runs);
    await call(commit, tx);
    return result;
  } catch (ex) {
    await call(rollback, tx);
    throw ex;
  }
}
function updateMany(call, ids, values) {
  const subCalls = ids.map(id => ({ fn: updateItem, args: [id, values] }));
  return call(inTransaction, subCalls);
}
```

In this version, rather than providing an dynamic function for `inTransaction` to run, the
function accepts an array of `{ fn, args: [] }` objects. Because the list of calls to run
are described as data, rather than an opaque dynamic function the unit tests will not require
controlled execution.

```js
const affectTest = require('affect/test');
describe('updateMany()', () => {
  it('will commit all updates', () => {
    const values = { fieldName: 'value' };
    return affectTest(updateMany)
      .args([1, 2], values)
      .calls(inTransaction, [
        { fn: updateItem, args: [1, values] },
        { fn: updateItem, args: [2, values] }
      ]).callReturns([{ id: 1 }, { id: 2 }])
      .expectsReturn([{ id: 1 }, { id: 2 }]);
  });
});
```

It is recommended that you avoid controlled execution when possible by describing execution
as arguments, rather than defining dynamic functions. Doing so will simplify unit tests and
avoid repetitive tests which may break during refactoring.

### Test Runners
Affect has been written to produce nice errors in both mocha and jest. By default the assertions
made within a `affectTest` chain will use node's native `assert` methods, but if a global `expect`
interface is available (as provided by jest), that interface will be used.

Any test runner which supports promises as reject = fail, resolve = pass should work with Affect.

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

### Getting Telemetry
The `affect` function accepts an optional `config` object as it's second argument. You can specify the following event handers:

* `onFunction` - event handler called when before exported affect function is executed  
  Event hander arguments: `{ fn: Function, args: Array, context: Object, start: timeMs }`.
* `onCall` - event handler called when before each call method is executed  
  Event hander arguments: `{ fn: Function, args: Array, context: Object, start: timeMs }`.
* `onCallComplete` - event handler called after each mock is executed  
  Event hander arguments: `{ fn: Function, args: Array, context: Object, start: timeMs, end: timeMs, latency: Ms, success: boolean, result: data/error }`.
* `onFunctionComplete` - event handler called after `fn` is executed  
  Event hander arguments: `{ fn: Function, args: Array, context: Object, start: timeMs, end: timeMs, latency: Ms, success: boolean, result: data/error }`.

#### Detailed Logging Example
This example will print each function and call to the `console.log`.

```js
const affect = require('affect');
const getUser = require('./methods/get-user');
const concatFiles = require('./methods/concat-files');
const sendTime = require('./methods/send-time');
const config = {
  onFunction({ fn }) {
    console.log('onFunction:', fn.name);
  },
  onFunctionComplete({ fn, latency, success, result }) {
    const outcome = success ? 'Completed' : `Error: ${result.message}`;
    console.log('onFunctionComplete:', fn.name, outcome, `(${latency}ms)`);
  },
  onCall({ fn }) {
    console.log('onCall:', fn.name);
  },
  onCallComplete({ fn, latency, success, result }) {
    const outcome = success ? 'Returned' : `Error: ${result.message}`;
    console.log('onCallComplete:', fn.name, outcome, `(${latency}ms)`);
  }
};
const functions = affect({
  getUser,
  concatFiles,
  sendTime
}, config);
module.exports = functions;
```

The output log from calling `functions.sendTime()` with the above `config` handlers would look like:

```
onFunction: sendTime
onCall: now
onCallComplete: now Completed (1ms)
onCall: readFile
onCallComplete: readFile Completed (46ms)
onCall: fetch
onCallComplete: fetch Completed (315ms)
onCall: json
onCallComplete: json Completed (6ms)
onFunctionComplete: sendTime Completed (398ms)
```

### Using Context
The `affect` config object allows an optional `context` property to be provided.
This object can be read within event handlers and within affect methods using `call.context`.

Additionally, each function built by `affect` has a property `.withContext()`.
Calling the function using `.withContext(context, ...args)` will merge the invocation specific context with the original config values.

#### Context example
```js
const affect = require('affect');
const getUser = require('./methods/get-user');
const concatFiles = require('./methods/concat-files');
const sendTime = require('./methods/send-time');
const config = {
  context: { overridden: false, notchanged: true }
};
const functions = affect({
  getUser,
  concatFiles,
  sendTime
}, config);
module.exports = functions;
```

If you used `functions.sendTime.withContext({ overridden: true })` then the `call.context` object would be:  
`{ overridden: true, notchanged: true }`

#### Why context?
While all your code is simple to unit test, you may want to use runtime validation patterns or enable
end-to-end tests using actual code paths. Using the context object allows you to include additional
side-channel information for this purpose.

#### Selectively disable logging example
In the example below, calling `functions.sendTime()` would be logged, but `functions.sendTime.withContext({ logging: false })` would not be logged.

```js
const affect = require('affect');
const sendTime = require('./methods/send-time');
const config = {
  context: { logging: true },
  onFunction({ fn, context }) {
    if (context.logging) {
      console.log('onFunction:', fn.name);
    }
  }
};
const functions = affect({
  sendTime
}, config);
module.exports = functions;
```

#### End-to-end test example
In the example below, we assume there is an automated end-to-end test harness, which creates actual data, but needs to track which records are tests, so they can be cleaned up periodically.

When `functions.saveUser(userData)` is called normally the data is not saved as a test record.
However, when called with `functions.saveUser.withContext({ isE2E: true }, userData)` the `recordTest` method will be called.

```js
async function saveUser(call, userData) {
  const userId = call(insertUser, userData);
  if (call.isE2E) {
    await recordTest({ table: 'users', field: 'userId', value: userId });
  }
  return userId;
}
```

#### Final thoughts on context
You should never be putting very much information into the context. All other program state and configuration should be read directly using unit testable functions and the `call` interfaces. Context is intended only for special cases of testing within a runtime, and should NEVER be used as a way to inject general application config or state data.

## Notes on Promises
By default all Affect functions and tests will return whatever global `Promise` object is defined in the environment. For older browsers remember to include your favorite shim.

### BYO Promise
Affect can use your favorite promise library in Affect by assigning it to `affect.Promise`. Just ensure you assign it before using `affect()` or `affectTest()`.

```js
const affect = require('affect');
const Bluebird = require('bluebird');
affect.Promise = Bluebird;
```
