const EventEmitter = require('events');
const assert = require('assert');
const buildCaller = require('./call');
const affect = require('./');

function mockThrow(_, fnName, err) {
	throw err;
}
function mockReturn(_, fnName, result) {
	return result;
}

class MockStack {
	constructor() {
		this.stack = [];
		this.idx = 0;
	}
	get head() {
		return this.stack[this.stack.length - 1];
	}
	get tail() {
		return this.stack[0];
	}
	get length() {
		return this.stack.length;
	}
	append(expectFn, expectArgs) {
		this.stack.push({ expectFn, expectArgs, success: null, result: null });
	}
	next() {
		const number = this.idx;
		this.idx += 1;
		return {
			number,
			frame: this.stack[number]
		};
	}
}

function startTest(testFn) {
	assert.strictEqual(typeof testFn, 'function', 'startTest(fn) requires a function argument');

	const emitter = new EventEmitter();

	const stack = new MockStack();

	const runTest = () => {
		let testRunError = false;
		const testError = new Error('within test');

		const { frame: { expectFn: mainFn, expectArgs: mainArgs, success: mainSuccess, result: mainResult } } = stack.next();
		const realCall = buildCaller(affect.Promise, emitter, (callFn, ...callArgs) => {
			const { frame, number } = stack.next();
			try {
				if (!frame) {
					assert.fail(`#${number}`, `#${stack.length}`, `#${number}: Unexpected call(${callFn.name}), no more calls expected`, '>');
				}
				const { expectFn, expectArgs, success, result } = frame;
				assert.strictEqual(callFn, expectFn, `#${number}: Unexpected call(${callFn.name}), expected call(${expectFn.name})`);
				assert.deepStrictEqual(callArgs, expectArgs, `#${number}: Unexpected arguments for ${callFn.name}()`);
				return realCall(success ? mockReturn : mockThrow, callFn.name, result);
			} catch (ex) {
				// prevent internal method error handling from accessing real error
				testRunError = ex;
				throw testError;
			}
		});

		return realCall(mainFn, ...mainArgs)
			.then((result) => {
				if (testRunError) {
					throw testError;
				}
				if (mainSuccess === true) {
					assert.deepStrictEqual(result, mainResult, 'Unexpected final results');
				} else {
					try {
						assert.fail(result, mainResult, 'Returned data, but should have thrown');
					} catch (ex) {
						testRunError = ex;
						throw testError;
					}
				}
			})
			.catch((err) => {
				if (testRunError) {
					throw testRunError;
				}
				if (mainSuccess === false) {
					// FIXME: better error checking
					assert.strictEqual(err.message, mainResult.message);
					return;
				}
				throw err;
			})
			.then(() => {
				const uncalled = stack.stack
					.filter((s, idx) => idx > (stack.idx - 1))
					.map(({ expectFn }) => `${expectFn.name}()`);

				assert.strictEqual(uncalled.length, 0, `Expected additional calls: ${uncalled.join(', ')}`);
			});
	};

	let endCall;
	const forCall = {
		awaitsCall(fn, ...args) {
			assert.strictEqual(typeof fn, 'function', '.awaitsCall(fn, ...args) requires first argument as function');
			stack.append(fn, args);
			return endCall;
		},
		returns(result) {
			Object.assign(stack.tail, { success: true, result });
			return runTest();
		},
		throws(result) {
			Object.assign(stack.tail, { success: false, result });
			return runTest();
		},
		callReturns() {
			assert.fail('.callReturns()', '.awaitsCall()', '.callReturns(data) can only come after .awaitsCall()');
		},
		callThrows() {
			/* istanbul ignore next */
			assert.fail('.callThrows()', '.awaitsCall()', '.callThrows(error) can only come after .awaitsCall()');
		}
	};
	endCall = {
		callReturns(result) {
			Object.assign(stack.head, { success: true, result });
			return forCall;
		},
		callThrows(result) {
			Object.assign(stack.head, { success: false, result });
			return forCall;
		},
		awaitsCall() {
			assert.fail('.awaitsCall()', '.callReturns()|.callThrows()', '.awaitsCall(fn, ...args) can only come after .callReturns() or .callThrows()');
		},
		returns() {
			assert.fail('.returns()', '.callReturns()|.callThrows()', '.returns(data) can only come after .callReturns() or .callThrows()');
		},
		throws() {
			/* istanbul ignore next */
			assert.fail('.throws()', '.callReturns()|.callThrows()', '.throws(error) can only come after .callReturns() or .callThrows()');
		}
	};
	const init = {
		onCall(handler) {
			emitter.on('onCall', handler);
			return init;
		},
		onCallComplete(handler) {
			emitter.on('onCallComplete', handler);
			return init;
		},
		args(...args) {
			stack.append(testFn, args);
			return forCall;
		},
		awaitsCall() {
			assert.fail('.awaitsCall()', '.args()', '.args(...args) must be called before .awaitsCall()');
		}
	};
	return init;
}

module.exports = startTest;
