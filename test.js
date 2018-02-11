const assert = require('assert');
const affect = require('./affect');

function name(instance) {
	const type =
		(instance.constructor && instance.constructor !== Function && instance.constructor.name) || instance.name;
	return `<${type}>`;
}

class TestLink {
	constructor({ args, returns, throws }) {
		this.args = args;
		this.returns = returns;
		this.throws = throws;
	}
	outcome() {
		if (this.throws) {
			throw this.throws;
		}
		return this.returns;
	}
}
class TestCallLink extends TestLink {
	constructor(opts) {
		super(opts);
		const { fn, args } = opts;
		this.fn = fn;
		this.fnName = fn.name;
	}
	validate(n, whichCall, callArgs) {
		if (whichCall === 'call.bound') {
			assert.strictEqual(
				'call',
				'call.bound',
				`${n} test expected call to ${this.fnName}, but actually got call.bound(${name(callArgs[0])}, ${callArgs[1]})`
			);
		}
		const [actualFn, ...actualArgs] = callArgs;
		assert.strictEqual(
			actualFn,
			this.fn,
			`${n} test expected ${whichCall}(${this.fnName}), but actually got ${whichCall}(${actualFn.name})`
		);
		assert.deepStrictEqual(
			actualArgs,
			this.args,
			`${n} arguments for ${whichCall}(${this.fnName}) did not match those specified in test`
		);
	}
}
class TestBoundLink extends TestLink {
	constructor(opts) {
		const { instance, methodName } = opts;
		super(opts);
		this.instance = instance;
		this.methodName = methodName;
		this.instanceName = name(instance);
	}
	validate(n, whichCall, callArgs) {
		if (whichCall !== 'call.bound') {
			assert.strictEqual(
				'call.bound',
				whichCall,
				`${n} test expected call.bound(${this.instanceName}, ${this.methodName}), but actually got ${whichCall}(${
					callArgs[0].name
				})`
			);
		}
		const [actualInstance, actualMethodName, ...actualArgs] = callArgs;
		assert.strictEqual(
			actualInstance,
			this.instance,
			`${n} call.bound() instance ${name(actualInstance)} did not match instance ${this.instanceName} specified in test`
		);
		assert.strictEqual(
			actualMethodName,
			this.methodName,
			`${n} test expected call.bound(${this.instanceName}, ${this.methodName}), ` +
				`but actually got call.bound(${name(actualInstance)}, ${actualMethodName})`
		);
		assert.deepStrictEqual(
			actualArgs,
			this.args,
			`${n} arguments for call.bound(${this.instanceName}, ${this.methodName}) did not match those specified in test`
		);
	}
}

const callInterfaces = ['bound', 'sync', 'plain', 'fromCb', 'multiCb'];
function callProxy(handler) {
	const call = (...args) => handler('call', args);
	return callInterfaces.reduce((c, prop) => Object.assign(c, { [prop]: (...a) => handler(`call.${prop}`, a) }), call);
}

function affectTest(mainMethod) {
	let mainArgs;
	let nextLinkClass;
	let nextLinkOpts;

	const stack = [];
	function extendChain(resultOpts) {
		Object.assign(nextLinkOpts, resultOpts);
		const link = new nextLinkClass(nextLinkOpts);
		stack.push(link);
		nextLinkClass = undefined;
		nextLinkOpts = undefined;
	}

	function runTest(success, result) {
		const internalError = new Error('X');
		let validateError;
		let linkIndex = -1;
		const call = callProxy((whichCall, callArgs) => {
			linkIndex++;
			const link = stack[linkIndex];
			const n = `#${linkIndex + 1}`;
			try {
				if (!link) {
					// past end of stack
					assert.fail(
						linkIndex + 1,
						stack.length,
						`test specified ${stack.length} calls but actual method made ${linkIndex +
							1} or more calls: ${n} should be ` +
							(whichCall === 'call.bound'
								? `${whichCall}(${name(callArgs[0])}, ${callArgs[1]})`
								: `${whichCall}(${callArgs[0].name})`)
					);
				}
				link.validate(n, whichCall, callArgs);
			} catch (err) {
				if (!validateError) {
					validateError = err;
				}
				throw internalError;
			}
			return link.outcome();
		});
		return affect.Promise.resolve()
			.then(() => mainMethod(call, ...mainArgs))
			.then(outcome => {
				if (!validateError) {
					try {
						if (success === false) {
							assert.strictEqual(outcome, result, 'test expects throw, but method resolved without error');
						} else if (success === true) {
							assert.deepStrictEqual(outcome, result, 'test expects return, but resolved value was not equal');
						}
					} catch (err) {
						validateError = err;
					}
				}
				return outcome;
			})
			.catch(err => {
				if (validateError) {
					throw validateError;
				} else if (success === true) {
					validateError = err;
				} else if (success === false) {
					// compare errors
					if (err instanceof Error || (err.constructor && /Error$/.test(err.constructor.name))) {
						assert.strictEqual(
							err.constructor,
							result.constructor,
							`expected method to throw type ${result.constructor.name}, but actually got error type ${
								err.constructor.name
							}`
						);
						assert.strictEqual(err.message, result.message);
					} else {
						// Threw non-error type, so compare exact
						assert.deepStrictEqual(err, result);
					}
				} else {
					validateError = err;
				}
			})
			.then(outcome => {
				if (linkIndex < stack.length - 1) {
					// did not use whole stack
					assert.fail(
						linkIndex + 1,
						stack.length,
						`test expects ${stack.length} calls, but actual method only made ${linkIndex + 1} calls`
					);
				} else if (validateError) {
					throw validateError;
				}
				return outcome;
			});
	}

	let b;
	const a = {
		calls(fn, ...args) {
			nextLinkClass = TestCallLink;
			nextLinkOpts = { fn, args };
			return b;
		},
		callsBound(instance, methodName, ...args) {
			nextLinkClass = TestBoundLink;
			nextLinkOpts = { instance, methodName, args };
			return b;
		},
		expectsReturn(data) {
			return runTest(true, data);
		},
		expectsThrow(error) {
			return runTest(false, error);
		},
		run() {
			return runTest(null, null);
		}
	};
	b = {
		callReturns(returns) {
			extendChain({ returns });
			return a;
		},
		callResolves(data) {
			extendChain({ returns: affect.Promise.resolve(data) });
			return a;
		},
		callThrows(throws) {
			extendChain({ throws });
			return a;
		},
		callRejects(error) {
			extendChain({ returns: affect.Promise.reject(error) });
			return a;
		}
	};
	return {
		args(...args) {
			mainArgs = args;
			return a;
		}
	};
}
module.exports = affectTest;
