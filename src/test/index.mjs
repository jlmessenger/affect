import affect from '../index.mjs';
import assert from './assert.mjs';

const { buildCall, configEmitter, callRunners } = affect._internal;

function mockCallPlain(fnName, { success, result }) {
	if (success) {
		return result;
	}
	throw result;
}
function mockCall(call, fnName, outcome) {
	return mockCallPlain(fnName, outcome);
}
function mockCallSync(fnName, outcome) {
	return mockCallPlain(fnName, outcome);
}
function mockCallFromCb(fnName, { success, result }, cb) {
	if (success) {
		return cb(null, result);
	}
	return cb(result);
}
function mockCallMultiCb(fnName, { success, result }, cb) {
	if (success) {
		return cb(null, ...result);
	}
	return cb(result);
}

// Mock functions for each call.<method>() interface
const whichMock = {
	call: mockCall,
	plain: mockCallPlain,
	sync: mockCallSync,
	fromCb: mockCallFromCb,
	multiCb: mockCallMultiCb
};

// Build mock runners for each call.<method>() interface
const mockRunners = Object.keys(callRunners).reduce((forMock, name) => {
	const realRunner = callRunners[name];
	forMock[name] = (opts, fn, ...args) => {
		const mockArgs = opts.context.verify(fn, args);
		return realRunner(opts, whichMock[name], ...mockArgs);
	};
	return forMock;
}, {});

class MockStack {
	constructor() {
		this.stack = [];
		this.idx = 0;
		this.number = 0;
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
	append(expectFn, expectArgs, n = false, success = null, result = null) {
		let number = n;
		if (!n) {
			number = `#${this.number}`;
			this.number += 1;
		}
		this.stack.push({ number, expectFn, expectArgs, success, result });
	}
	appendAll(arrayFnArgsOutcome) {
		arrayFnArgsOutcome.forEach((entry, i) => {
			const success = entry.hasOwnProperty('returns');
			const args = !entry.hasOwnProperty('args')
				? []
				: Array.isArray(entry.args) ? entry.args : [entry.args];
			this.append(
				entry.fn,
				args,
				`${this.number}[${i}]`,
				success,
				success ? entry.returns : entry.throws
			);
		});
		this.number += 1;
	}
	next() {
		const frame = this.stack[this.idx];
		const number = (frame && frame.number) || `#${this.number}`;
		this.idx += 1;
		return {
			number,
			frame
		};
	}
}

/**
 * Begin unit test runner
 * @param {Function} testFn - Affect function to be tested
 * @param {Object} testConfig
 * @param {Function} testConfig.onFunction
 * @param {Function} testConfig.onFunctionComplete
 * @param {Function} testConfig.onCall
 * @param {Function} testConfig.onCallComplete
 * @param {Object} testConfig.context
 */
export default function affectTest(testFn, testConfig = {}) {
	assert.strictEqual(typeof testFn, 'function', 'startTest(fn) requires a function argument');
	const { context = {} } = testConfig;
	const emitter = configEmitter(testConfig);

	const stack = new MockStack();

	const runTest = () => {
		let testRunError = false;
		const testError = new Error('within test');

		const {
			frame: { expectFn: mainFn, expectArgs: mainArgs, success: mainSuccess, result: mainResult }
		} = stack.next();

		const verify = (callFn, callArgs) => {
			const { frame, number } = stack.next();
			try {
				if (!frame) {
					assert.fail(
						number,
						`#${stack.length - 1}`,
						`${number}: Unexpected call(${callFn.name}), no more calls expected`,
						'>'
					);
				}
				const { all, expectFn, expectArgs, success, result } = frame;
				assert.strictEqual(
					callFn,
					expectFn,
					`${number}: Unexpected call(${callFn.name}), expected call(${expectFn.name})`
				);
				assert.deepStrictEqual(
					callArgs,
					expectArgs,
					`${number}: Unexpected arguments for ${callFn.name}()`
				);
				return [callFn.name, { success, result }];
			} catch (ex) {
				// prevent internal method error handling from accessing real error
				testRunError = ex;
				throw testError;
			}
		};

		const methodInit = buildCall(
			affect.Promise,
			emitter,
			Object.assign(context, { verify }),
			mockRunners
		);

		return methodInit(mainFn)(...mainArgs)
			.then(result => {
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
			.catch(err => {
				if (testRunError) {
					throw testRunError;
				}
				if (mainSuccess === false) {
					if (err instanceof Error || (err.constructor && /Error$/.test(err.constructor.name))) {
						assert.strictEqual(
							err.constructor,
							mainResult.constructor,
							`${err.constructor.name} must be instance of ${mainResult.constructor.name}`
						);
						assert.strictEqual(err.message, mainResult.message);
					} else {
						// Threw non-error type, so compare exact
						assert.deepStrictEqual(err, mainResult);
					}
					return;
				}
				throw err;
			})
			.then(() => {
				const uncalled = stack.stack
					.filter((s, idx) => idx > stack.idx - 1)
					.map(({ expectFn }) => `${expectFn.name}()`);

				assert.strictEqual(uncalled.length, 0, `Expected additional calls: ${uncalled.join(', ')}`);
			});
	};

	let endCall;
	const forCall = {
		awaitsCall(fn, ...args) {
			assert.strictEqual(
				typeof fn,
				'function',
				'.awaitsCall(fn, ...args) requires first argument as function'
			);
			stack.append(fn, args);
			return endCall;
		},
		awaitsAllCalls(arrayFnArgsOutcome) {
			assert.ok(
				Array.isArray(arrayFnArgsOutcome) && arrayFnArgsOutcome.length,
				'.awaitsAllCalls([{fn, args, returns/throws}, ...]) requires non-empty array argument'
			);
			arrayFnArgsOutcome.forEach((entry, i) => {
				assert.strictEqual(
					typeof entry.fn,
					'function',
					`.awaitsAllCalls([{fn, args, returns/throws}, ...]) requires argument[${i}].fn as a function`
				);
				assert.ok(
					entry.hasOwnProperty('returns') || entry.hasOwnProperty('throws'),
					`.awaitsAllCalls([{fn, args, returns/throws}, ...]) requires argument[${i}] must have property {returns: data} or {throws: error}`
				);
			});
			stack.appendAll(arrayFnArgsOutcome);
			return forCall;
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
			assert.fail(
				'.callReturns()',
				'.awaitsCall()',
				'.callReturns(data) can only come after .awaitsCall()'
			);
		},
		callThrows() {
			/* istanbul ignore next */
			assert.fail(
				'.callThrows()',
				'.awaitsCall()',
				'.callThrows(error) can only come after .awaitsCall()'
			);
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
			assert.fail(
				'.awaitsCall()',
				'.callReturns()|.callThrows()',
				'.awaitsCall(fn, ...args) can only come after .callReturns() or .callThrows()'
			);
		},
		awaitsAllCalls() {
			assert.fail(
				'.awaitsAllCalls()',
				'.callReturns()|.callThrows()',
				'.awaitsAllCalls([{fn, args, returns/throws}, ...]) can only come after .callReturns() or .callThrows()'
			);
		},
		returns() {
			assert.fail(
				'.returns()',
				'.callReturns()|.callThrows()',
				'.returns(data) can only come after .callReturns() or .callThrows()'
			);
		},
		throws() {
			/* istanbul ignore next */
			assert.fail(
				'.throws()',
				'.callReturns()|.callThrows()',
				'.throws(error) can only come after .callReturns() or .callThrows()'
			);
		}
	};
	const init = {
		args(...args) {
			stack.append(testFn, args);
			return forCall;
		},
		awaitsCall() {
			assert.fail('.awaitsCall()', '.args()', '.args(...args) must be called before .awaitsCall()');
		},
		awaitsAllCalls() {
			assert.fail(
				'.awaitsAllCalls()',
				'.args()',
				'.args(...args) must be called before .awaitsAllCalls()'
			);
		}
	};
	return init;
}
