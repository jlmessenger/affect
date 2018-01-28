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
		const { execute, mockArgs } = opts.context.verify(fn, args);
		if (execute === true) {
			return realRunner(opts, fn, ...args);
		}
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
	append(expectFn, expectArgs, n = false, success = null, result = null, execute = false) {
		let number = n;
		if (!n) {
			number = `#${this.number}`;
			this.number += 1;
		}
		const fnArgIdxs = expectArgs.map((arg, i) => i).filter(i => expectArgs[i] === Function);
		this.stack.push({ number, expectFn, expectArgs, success, result, fnArgIdxs, execute });
	}
	appendAll(arrayFnArgsOutcome) {
		arrayFnArgsOutcome.forEach((entry, i) => {
			const execute = entry.execute || false;
			const args = !entry.hasOwnProperty('args')
				? []
				: Array.isArray(entry.args) ? entry.args : [entry.args];
			const number = `${this.number}[${i}]`;
			if (execute) {
				this.append(entry.fn, args, number, null, null, true);
			} else {
				const success = entry.hasOwnProperty('returns');
				this.append(entry.fn, args, number, success, success ? entry.returns : entry.throws);
			}
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
	assert.strictEqual(typeof testFn, 'function', 'affectTest(fn) requires a function argument');
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
				const { all, expectFn, expectArgs, success, result, fnArgIdxs, execute } = frame;
				assert.strictEqual(
					callFn,
					expectFn,
					`${number}: Unexpected call(${callFn.name}), expected call(${expectFn.name})`
				);
				const callArgsGeneric = fnArgIdxs.length ? callArgs.slice() : callArgs;
				fnArgIdxs.forEach(i => {
					if (typeof callArgs[i] === 'function') {
						callArgsGeneric[i] = Function;
					}
				});
				assert.deepStrictEqual(
					callArgsGeneric,
					expectArgs,
					`${number}: Unexpected arguments for ${callFn.name}()`
				);
				const mockArgs = [callFn.name, { success, result }];
				return { execute, mockArgs };
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
		calls(fn, ...args) {
			assert.strictEqual(
				typeof fn,
				'function',
				'.calls(fn, ...args) requires first argument as function'
			);
			stack.append(fn, args);
			return endCall;
		},
		callsAll(arrayFnArgsOutcome) {
			assert.ok(
				Array.isArray(arrayFnArgsOutcome) && arrayFnArgsOutcome.length,
				'.callsAll([{fn, args, returns/throws}, ...]) requires non-empty array argument'
			);
			arrayFnArgsOutcome.forEach((entry, i) => {
				assert.strictEqual(
					typeof entry.fn,
					'function',
					`.callsAll([{fn, args, returns/throws}, ...]) requires argument[${i}].fn as a function`
				);
				assert.ok(
					entry.execute === true ||
						entry.hasOwnProperty('returns') ||
						entry.hasOwnProperty('throws'),
					`.callsAll([{fn, args, returns/throws/execute}, ...]) requires argument[${i}] must have property: {returns: data}, {throws: error} or {execute: true}`
				);
			});
			stack.appendAll(arrayFnArgsOutcome);
			return forCall;
		},
		expectsReturn(result) {
			Object.assign(stack.tail, { success: true, result });
			return runTest();
		},
		expectsThrow(result) {
			Object.assign(stack.tail, { success: false, result });
			return runTest();
		},
		callReturns() {
			assert.fail('.callReturns()', '.calls()', '.callReturns(data) can only come after .calls()');
		},
		callThrows() {
			/* istanbul ignore next */
			assert.fail('.callThrows()', '.calls()', '.callThrows(error) can only come after .calls()');
		},
		callExecute() {
			/* istanbul ignore next */
			assert.fail('.callExecute()', '.calls()', '.callExecute() can only come after .calls()');
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
		callExecute() {
			Object.assign(stack.head, { execute: true });
			return forCall;
		},
		calls() {
			assert.fail(
				'.calls()',
				'.callReturns()|.callThrows()',
				'.calls(fn, ...args) can only come after .callReturns() or .callThrows()'
			);
		},
		callsAll() {
			assert.fail(
				'.callsAll()',
				'.callReturns()|.callThrows()',
				'.callsAll([{fn, args, returns/throws}, ...]) can only come after .callReturns() or .callThrows()'
			);
		},
		expectsReturn() {
			assert.fail(
				'.expectsReturn()',
				'.callReturns()|.callThrows()',
				'.expectsReturn(data) can only come after .callReturns() or .callThrows()'
			);
		},
		expectsThrow() {
			/* istanbul ignore next */
			assert.fail(
				'.expectsThrow()',
				'.callReturns()|.callThrows()',
				'.expectsReturn(error) can only come after .callReturns() or .callThrows()'
			);
		}
	};
	const init = {
		args(...args) {
			stack.append(testFn, args);
			return forCall;
		},
		calls() {
			assert.fail('.call()', '.args()', '.args(...args) must be called before .calls()');
		},
		callsAll() {
			assert.fail('.callsAll()', '.args()', '.args(...args) must be called before .callsAll()');
		}
	};
	return init;
}
