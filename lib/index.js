const EventEmitter = require('events');
const assert = require('assert');

const affect = { Promise };

function afterCall(emitter, temp, success, result) {
	temp.success = success;
	temp.result = result;
	temp.end = Date.now();
	temp.latency = temp.end - temp.start;
	emitter.emit('onCallComplete', temp);
	if (success) {
		return result;
	}
	throw result;
}

function preCall(emitter, fn, args) {
	const start = Date.now();
	emitter.emit('onCall', { fn, args, start });
	const temp = { fn, args, success: null, result: null, start, end: null, latency: null };
	return {
		resolved: afterCall.bind(null, emitter, temp, true),
		thrown: afterCall.bind(null, emitter, temp, false)
	};
}

function buildCaller(emitter, caller) {
	let nextCall;
	const runner = (isPlain, fn, ...args) => {
		const { resolved, thrown } = preCall(emitter, fn, args);
		const r = isPlain ? args : [nextCall].concat(args);
		return affect.Promise.resolve(r)
			.then(a => fn(...a))
			.then(resolved, thrown);
	};
	const call = (...a) => runner(false, ...a);
	call.plain = (...a) => runner(true, ...a);
	nextCall = caller || call;
	nextCall.plain = caller || call.plain;
	return call;
}

function mockThrow(_, fnName, err) {
	throw err;
}
function mockReturn(_, fnName, result) {
	return result;
}

function buildFunctions(methods, config = {}) {
	const emitter = new EventEmitter();
	const { onCall, onCallComplete } = config;
	if (onCall) {
		emitter.on('onCall', onCall);
	}
	if (onCallComplete) {
		emitter.on('onCallComplete', onCallComplete);
	}

	const theCaller = buildCaller(emitter);
	return Object.keys(methods).reduce((copy, name) =>
		Object.assign(copy, { [name]: theCaller.bind(null, methods[name]) })
	, {});
}

function startTest(testFn) {
	const emitter = new EventEmitter();
	const callStack = [];
	let stackHead = null;
	let methodStack = null;
	const pushToStack = (expectFn, expectArgs) => {
		if (typeof expectFn !== 'function') {
			throw new Error(`awaitsCall() must be a function, got: ${expectFn}`);
		}
		stackHead = { expectFn, expectArgs, success: null, result: null };
		callStack.push(stackHead);
	};

	let earlyFailure = false;
	const runTest = () => {
		let stackIdx = 0;
		const callRaw = buildCaller(emitter, (callFn, ...callArgs) => {
			stackIdx += 1;
			const stack = callStack[stackIdx];
			try {
				if (!stack) {
					assert.strictEqual(Symbol('S_OVER'), stackIdx, `#${stackIdx}: Unexpected call(${callFn.name}), no more calls expected`);
				}
				const { expectFn, expectArgs, success, result } = stack;
				assert.strictEqual(callFn, expectFn, `#${stackIdx}: Unexpected call(${callFn.name}), expected call(${expectFn.name})`);
				assert.deepEqual(callArgs, expectArgs, `#${stackIdx}: Unexpected arguments for ${callFn.name}`);
				return callRaw(success ? mockReturn : mockThrow, callFn.name, result);
			} catch (ex) {
				// prevent internal method error handling from accessing real error
				earlyFailure = ex;
				throw new Error('fail');
			}
		});

		return callRaw(methodStack.expectFn, ...methodStack.expectArgs)
			.then((result) => {
				if (earlyFailure) {
					throw earlyFailure;
				}
				if (methodStack.success === true) {
					assert.deepEqual(result, methodStack.result, 'Unexpected final results');
				} else {
					try {
					// FIXME: make this pass-thru better
						assert.strictEqual(Symbol('FAIL'), result, 'Returned data, but should have thrown');
					} catch (ex) {
						earlyFailure = ex;
						throw ex;
					}
				}
			})
			.catch((err) => {
				if (earlyFailure) {
					throw earlyFailure;
				}
				if (methodStack.success === false) {
					// FIXME: better error checking
					assert.strictEqual(err.message, methodStack.result.message);
					return;
				}
				throw err;
			})
			.then(() => {
				const uncalled = callStack
					.filter((s, idx) => idx > stackIdx)
					.map(({ expectFn }) => `${expectFn.name}()`);

				assert.strictEqual(uncalled.length, 0, `Expected additional calls: ${uncalled.join(', ')}`);
			});
	};

	let endCall;
	const forCall = {
		awaitsCall(fn, ...args) {
			pushToStack(fn, args);
			return endCall;
		},
		returns(result) {
			Object.assign(methodStack, { success: true, result });
			return runTest();
		},
		throws(result) {
			Object.assign(methodStack, { success: false, result });
			return runTest();
		}
	};
	endCall = {
		callReturns(result) {
			Object.assign(stackHead, { success: true, result });
			return forCall;
		},
		callThrows(result) {
			Object.assign(stackHead, { success: false, result });
			return forCall;
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
			pushToStack(testFn, args);
			methodStack = stackHead;
			return forCall;
		}
	};
	return init;
}

module.exports = affect;
affect.startTest = startTest;
affect.buildFunctions = buildFunctions;
