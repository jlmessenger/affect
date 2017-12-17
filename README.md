# Affect
Affect is a micro abstraction layer for Javascript that simplifies unit testing and monitoring side-effects.

## Setup
```sh
npm install --save affect
```

## Usage Example
This example provides a REST api for looking up a user.

The raw database access `queryDb` and user lookup function `findUser`
are defined as _affect_ methods, where the first argument is `call`.

The `call` method can be used to call other _affect_ methods. However,
since they are called indirectly, the _affect_ framework can simplify
unit testing.

#### `database.js`
This file contains _affect_ methods for simple SQL based operations.
Each method has `call` as the first argument, and uses it when
dispatching to other _affect_ methods.
```js
function queryDb(call, sql, inputs) {
	return getDb()
		.request()
		.query(sql, inputs)
		.then(({recordset}) => recordset);
}

async function findUser(call, name) {
	const users = await call(
		queryDb,
		'SELECT * FROM users WHERE userName = @name LIMIT 1',
		{ name }
	);
	return Array.isArray(users) && users.length > 0 ? user[0] : null;
}

module.exports = {
	queryDb,
	findUser
};
```

#### `functions.js`
This file converts any _affect_ methods into regular methods, where the
call argument is removed, allowing them to be called as normal functions.
```js
const { buildFunctions } = require('affect');
const { findUser } = require('./database');

module.exports = buildFunctions({ findUser /* could add other affect methods */ });
```

#### `server.js`
This file is a sample REST api server that shows an example of using
the built function `findUser` as a normal function (no call argument needed).
```js
const express = require('express');
const app = module.exports = express();

const { findUser } = require('./functions');

app.get('/user/:name', (req, res, next) => {
	return findUser(req.params.name)
		.then(response => res.json(response))
		.catch(next);
});
```

#### `find-user.spec.js`
This file shows how unit test mocks can be simplified for _affect_ methods.
The unit test covers all aspects of the method, but is able to mock the
calls to the `queryDb` method.

```js
const { startTest } = require('affect');
const { findUser, queryDb } = require('./database');

describe('findUser', () => {
	it('returns first row', () => {
		const userRowFixture = { userId: 100, name: 'someuser', email: 'someuser@example.com' };
		return startTest(findUser)
			.args(userRowFixture.name)
			.awaitsCall(queryDb, userRowFixture.name).callReturns({ recordset: [userRowFixture] })
			.returns(userRowFixture)
	});
	it('returns null if no results', () => {
		const name = 'notfound';
		return startTest(findUser)
			.args(name)
			.awaitsCall(queryDb, name).callReturns({ recordset: [] })
			.returns(null);
	});
	it('passes-thru db errors', () => {
		const name = 'willthrow';
		const dbError = new Error('DB error');
		return startTest(findUser)
			.args(name)
			.awaitsCall(queryDb, name).callThrows(dbError)
			.throws(dbError);
	});
});
```

## Calling Plain Functions
There may be time when the function causing the side-effect is outside your control.
In this case you can wrap it as an _affect_ method, or you can use the short-cut `call.plain()`

```js
const { readFile } = require('fs-extra');

// even though readFile is not an affect-style method
// it can be called, and can also be mocked
async function countLines(call, filePath) {
	const lines = await call.plain(readFile, filePath);
	return lines.split('\n').length;
}
```

## Call Monitoring
The `buildFunctions` method accepts an optional second argument `config`, which can have
either of following properties: `onCall`, `onCallComplete`.

Below is an example of how the `function.js` file could be updated with these event handlers.

#### Example `functions.js`
```js
const { buildFunctions } = require('affect');
const { findUser } = require('./database');

const config = {
	onCall({ fn, args }) {
		const nice = args.map(a => inspect(a, { breakLength: Infinity })).join(', ');
		console.log('[START CALL]', `${fn.name}(${nice})`);
	},
	onCallComplete({ fn, success, latency, result }) {
		if (success) {
			console.log('[END CALL]', `${latency}ms ${fn.name}() - RESULT:`, result);
		} else {
			console.warn('[END CALL]', `${latency}ms ${fn.name}() - ERROR:`, result);
		}
	}
};

module.exports = buildFunctions({ findUser }, config);
```

If an API request was made to `/user/frankie`, the logs would show:
```sh
[START CALL] findUser('frankie')
[START CALL] queryDb('SELECT * FROM users WHERE userName = @name LIMIT 1', { name: 'frankie' })
[END CALL] 103ms queryDb() - RESULT: [{ userId: 101, name: 'frankie', email: 'frankie@example.com' }]
[END CALL] 106ms findUser() - RESULT: { userId: 101, name: 'frankie', email: 'frankie@example.com' }
```

## Unit Test Interface
* `startTest(method)` - The _affect_ method which will be run during the test.
* `.args(arg, uments)` - Arguments to pass into the method when the test is run.
* `.awaitsCall(method, arg, uments)` - Each `call()` within the method being tested, and the arguments it expects to be passed.
* `.callReturns(data)` - Mock data to return for the call.
* `.callThrows(error)` - Error to throw from the call.
* `.returns(expectedOutput)` - Expected output from the test method
* `.throws(expectedError)` - Expected rejection from the test method

#### Examples:
```js
async function methodBeingTested(call, one, two) {
	const a = await call(methodCalled, one);
	try {
		const b = await call(otherMethodCalled, two);
		return { a, b };
	} catch (ex) {
		return { fail: ex.message };
	}
}

// both calls succeed, so method returns output
return startTest(methodBeingTested)
	.args('a', 'b')
	.awaitsCall(methodCalled, 'a').callReturns('mock one')
	.awaitsCall(otherMethodCalled, 'b').callReturns('mock two')
	.returns({ a: 'mock one', b: 'mock two' });

// first calls throws, but is it not caught so method throws
return startTest(methodBeingTested)
	.args('a', 'b')
	.awaitsCall(methodCalled, 'a').callThrows(new Error('whoops'))
	.throws(new Error('whoops'));

// first call succeeds, second call throws but is caught
// so method returns alternate output
return startTest(methodBeingTested)
	.args('a', 'b')
	.awaitsCall(methodCalled, 'a').callReturns('mock one')
	.awaitsCall(otherMethodCalled, 'b').callThrows(new Error('whoops'))
	.returns({ fail: 'whoops' });
```

## BYO Promises
The promise chains returned by the _affect_ calls and unit tests
can be changed by assigning it into the library as follows:
```js
const Bluebird = require('bluebird');
const affect = require('affect');
affect.Promise = Bluebird;
```
