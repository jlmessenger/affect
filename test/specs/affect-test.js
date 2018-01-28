const util = require('util');
const { inner, outer, callsEach, delay } = require('../util.js');

module.exports = function({ assert, affectTest }) {
	describe('affectTest', () => {
		it('can mock inner call', () =>
			affectTest(outer)
				.args('zzz')
				.calls(inner, 'zzz')
				.callReturns('mock inner zzz1')
				.calls(inner, 'mock inner zzz1')
				.callReturns('mock inner zzz2')
				.expectsReturn('outer: mock inner zzz2'));
		it('can mock inner call in bulk', () =>
			affectTest(outer)
				.args('zzz')
				.callsAll([
					{ fn: inner, args: ['zzz'], returns: 'mock inner zzz1' },
					{ fn: inner, args: ['mock inner zzz1'], returns: 'mock inner zzz2' }
				])
				.expectsReturn('outer: mock inner zzz2'));
		it('can mock errors', () =>
			affectTest(outer)
				.args('yyy')
				.calls(inner, 'yyy')
				.callThrows(new Error('broke'))
				.expectsThrow(new Error('rethrow broke')));
		it('can execute subcalls', () =>
			affectTest(outer)
				.args('run')
				.calls(inner, 'run')
				.callExecute()
				.calls(inner, '(inner run)')
				.callExecute()
				.expectsReturn('outer: (inner (inner run))'));
		it('can execute subcalls in bulk', () =>
			affectTest(outer)
				.args('bulk')
				.callsAll([
					{ fn: inner, args: ['bulk'], execute: true },
					{ fn: inner, args: ['(inner bulk)'], execute: true }
				])
				.expectsReturn('outer: (inner (inner bulk))'));
		it('fail on error of incorrect type', () => {
			function TempE(m) {
				this.message = m;
			}
			util.inherits(TempE, Error);
			return affectTest(outer)
				.args('yyy')
				.calls(inner, 'yyy')
				.callThrows(new Error('tempe-error'))
				.expectsThrow(new TempE('tempe-error'))
				.catch(err => {
					if (!/^Error must be instance of TempE/.test(err.message)) {
						throw err;
					}
				});
		});
		it('can check thrown non-errors', () => {
			function called(call, a) {
				return `got: ${a}`;
			}
			function caller(call, a) {
				return call(called, a);
			}
			return affectTest(caller)
				.args('yyy')
				.calls(called, 'yyy')
				.callThrows('broke')
				.expectsThrow('broke');
		});
		it('can check thrown extended error types', () => {
			const err = new assert.AssertionError({ message: 'fail' });
			const err2 = new assert.AssertionError({ message: 'rethrow fail' });
			return affectTest(outer)
				.args('yyy')
				.calls(inner, 'yyy')
				.callThrows(err)
				.expectsThrow(err2);
		});
		it('emits events when configured', () => {
			const events = [];
			const err = new Error('busted');
			const testConfig = {
				onFunction({ fn, args }) {
					events.push({ event: 'onFunction', fnName: fn.name, args });
				},
				onFunctionComplete({ fn, args, success }) {
					events.push({
						event: 'onFunctionComplete',
						fnName: fn.name,
						args,
						success
					});
				},
				onCall({ fn, args }) {
					events.push({ event: 'onCall', fnName: fn.name, args });
				},
				onCallComplete({ fn, args, success }) {
					events.push({
						event: 'onCallComplete',
						fnName: fn.name,
						args,
						success
					});
				}
			};
			return affectTest(outer, testConfig)
				.args('xxx')
				.calls(inner, 'xxx')
				.callReturns('mock inner xxx')
				.calls(inner, 'mock inner xxx')
				.callThrows(err)
				.expectsThrow(new Error('rethrow busted'))
				.then(delay(2)) // ensure event handers are called
				.then(() => {
					assert.deepStrictEqual(events, [
						{ event: 'onFunction', fnName: 'outer', args: ['xxx'] },
						{
							event: 'onCall',
							fnName: 'mockCall',
							args: ['inner', { result: 'mock inner xxx', success: true }]
						},
						{
							event: 'onCallComplete',
							fnName: 'mockCall',
							args: ['inner', { result: 'mock inner xxx', success: true }],
							success: true
						},
						{
							event: 'onCall',
							fnName: 'mockCall',
							args: ['inner', { result: err, success: false }]
						},
						{
							event: 'onCallComplete',
							fnName: 'mockCall',
							args: ['inner', { result: err, success: false }],
							success: false
						},
						{
							event: 'onFunctionComplete',
							fnName: 'outer',
							args: ['xxx'],
							success: false
						}
					]);
				});
		});
		it('will throw if fn arg is wrong', () => {
			try {
				affectTest(outer)
					.args('www')
					.calls(inner, 'www')
					.callReturns('mock inner www1')
					.calls('whoops', 'mock inner www1')
					.callReturns('mock inner www2')
					.expectsReturn('outer: mock inner www2')
					.throw(new Error('should not run'));
				throw new Error('should have thrown');
			} catch (ex) {
				if (!/^\.calls\(fn, \.\.\.args\) requires first argument as function/.test(ex.message)) {
					throw ex;
				}
			}
		});
		it('allows generated call Function arguments', () => {
			function wrapHandler(call, arg, handlerFn) {
				return handlerFn(arg);
			}
			function main(call) {
				return call(wrapHandler, 'a', a => {
					return 'b';
				});
			}
			return affectTest(main)
				.args()
				.calls(wrapHandler, 'a', Function)
				.callReturns('x')
				.expectsReturn('x');
		});
		it('will throw if Function argument is not a function', () => {
			function wrapHandler(call, arg, handlerFn) {
				return handlerFn(arg);
			}
			function main(call) {
				return call(wrapHandler, 'a', 'b');
			}
			return affectTest(main)
				.args()
				.calls(wrapHandler, 'a', Function)
				.callReturns('x')
				.expectsReturn('x')
				.catch(err => {
					if (!/^#1: Unexpected arguments for wrapHandler\(\)/.test(err.message)) {
						throw err;
					}
				});
		});
		it('will throw if mock stack too short', () =>
			affectTest(outer)
				.args('vvv')
				.calls(inner, 'vvv')
				.callReturns('mock inner vvv1')
				.expectsReturn('outer: mock inner vvv1')
				.then(r => assert.fail(r, null, 'Should have thrown'))
				.catch(err => {
					if (!/^#2: Unexpected call\(inner\), no more calls expected/.test(err.message)) {
						throw err;
					}
				}));
		it('will throw if mock stack too long', () =>
			affectTest(outer)
				.args('uuu')
				.calls(inner, 'uuu')
				.callReturns('mock inner uuu1')
				.calls(inner, 'mock inner uuu1')
				.callReturns('mock inner uuu2')
				.calls(outer, 'mock inner uuu2')
				.callReturns('mock outer uuu3')
				.calls(inner, 'mock outer uuu3')
				.callReturns('mock inner uuu4')
				.expectsReturn('outer: mock inner uuu2')
				.then(r => assert.fail(r, null, 'Should have thrown'))
				.catch(err => {
					if (!/^Expected additional calls: outer\(\), inner\(\)/.test(err.message)) {
						throw err;
					}
				}));
		it('will fail if thrown error does not match', () =>
			affectTest(outer)
				.args('ttt')
				.calls(inner, 'ttt')
				.callThrows(new Error('broke'))
				.expectsThrow(new Error('wrong error'))
				.then(r => assert.fail(r, null, 'Should have thrown'))
				.catch(err => {
					if (
						(err.actual || err.matcherResult.actual) !== 'rethrow broke' &&
						(err.expected || err.matcherResult.expected) !== 'wrong error'
					) {
						throw err;
					}
				}));
		it('will fail if thrown but return expected', () =>
			affectTest(outer)
				.args('sss')
				.calls(inner, 'sss')
				.callReturns('mock inner sss1')
				.calls(inner, 'mock inner sss1')
				.callReturns('mock inner sss2')
				.expectsThrow(new Error('will fail'))
				.then(r => assert.fail(r, null, 'Should have thrown'))
				.catch(err => {
					if (!/Returned data, but should have thrown/.test(err.message)) {
						throw err;
					}
				}));
		it('will fail even if function catches the error', () => {
			async function eatIt(call, x) {
				try {
					return await call(inner, x);
				} catch (ex) {
					return 'ate-it';
				}
			}
			return affectTest(eatIt)
				.args('rrr')
				.calls(outer, 'rrr')
				.callReturns('mock inner rrr1')
				.expectsReturn('mock inner rrr1')
				.then(r => assert.fail(r, null, 'Should have thrown'))
				.catch(err => {
					if (!/^#1: Unexpected call\(inner\), expected call\(outer\)/.test(err.message)) {
						throw err;
					}
				});
		});
		it('will pass-thru unexpected errors', () => {
			async function throwIt(call, x) {
				await call(inner, x);
				throw new Error('throw-it');
			}
			return affectTest(throwIt)
				.args('qqq')
				.calls(inner, 'qqq')
				.callReturns('mock inner qqq1')
				.expectsReturn('never checked')
				.then(r => assert.fail(r, null, 'Should have thrown'))
				.catch(err => {
					if (!/^throw-it/.test(err.message)) {
						throw err;
					}
				});
		});
		it('can test calls to plain functions', () => {
			function pi(x) {
				return Promise.resolve([3.14, x]);
			}
			function callsPi(call) {
				return call.plain(pi, 159);
			}
			return affectTest(callsPi)
				.args()
				.calls(pi, 159)
				.callReturns('pi')
				.expectsReturn('pi');
		});
		it('can test calls to callback methods', () => {
			function someAction(a, cb) {
				cb(null, a);
			}
			function usesCallback(call) {
				return Promise.all([
					call.fromCb(someAction, 'callback'),
					call.multiCb(someAction, 'callback2')
				]);
			}
			return affectTest(usesCallback)
				.args()
				.calls(someAction, 'callback')
				.callReturns('mock callback')
				.calls(someAction, 'callback2')
				.callReturns(['mock callback2'])
				.expectsReturn(['mock callback', ['mock callback2']]);
		});
		it('can get errors from callback methods', () => {
			function someAction(a, cb) {
				cb(null, a);
			}
			function usesCallback(call) {
				return Promise.all([
					call.fromCb(someAction, 'callback').catch(err => err.message),
					call.multiCb(someAction, 'callback2').catch(err => err.message)
				]);
			}
			return affectTest(usesCallback)
				.args()
				.calls(someAction, 'callback')
				.callThrows(new Error('1st error'))
				.calls(someAction, 'callback2')
				.callThrows(new Error('2nd error'))
				.expectsReturn(['1st error', '2nd error']);
		});
		it('can test calls to sync functions', () => {
			function pi(x) {
				return [3.14, x];
			}
			function callsPi(call) {
				const x = call.sync(pi, 159);
				return x[1];
			}
			return affectTest(callsPi)
				.args()
				.calls(pi, 159)
				.callReturns(['fake', 'value'])
				.expectsReturn('value');
		});
		it('can resolve Promise.all methods with .callsAll()', () => {
			const callGroup = [
				{ fn: inner, args: ['a'], returns: '(inner a)' },
				{ fn: inner, args: ['b'], returns: '(inner b)' }
			];
			return affectTest(callsEach)
				.args()
				.calls(inner, '_')
				.callReturns('(inner _)')
				.callsAll(callGroup)
				.expectsReturn(['static', '(inner a)', '(inner b)']);
		});
		it('can reject Promise.all methods with .callsAll()', () => {
			const callGroup = [
				{ fn: inner, args: ['a'], returns: null },
				{ fn: inner, args: ['b'], throws: new Error('fail') }
			];
			return affectTest(callsEach)
				.args()
				.calls(inner, '_')
				.callReturns('(inner _)')
				.callsAll(callGroup)
				.expectsThrow(new Error('fail'));
		});
		it('will handle non-array args in .callsAll()', () => {
			const callGroup = [
				{ fn: inner, args: 'a', returns: '(inner a)' },
				{ fn: inner, args: 'b', returns: '(inner b)' }
			];
			return affectTest(callsEach)
				.args()
				.calls(inner, '_')
				.callReturns('(inner _)')
				.callsAll(callGroup)
				.expectsReturn(['static', '(inner a)', '(inner b)']);
		});
		it('will handle zero args calls in .callsAll()', () => {
			function callInner(call) {
				return call(inner);
			}
			const callGroup = [{ fn: inner, returns: '(inner undefined)' }];
			return affectTest(callInner)
				.args()
				.callsAll(callGroup)
				.expectsReturn('(inner undefined)');
		});
	});
};
