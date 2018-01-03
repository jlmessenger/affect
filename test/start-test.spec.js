/* eslint-disable newline-per-chained-call */
const assert = require('assert');
const { inherits } = require('util');
const startTest = require('../test');
const { inner, outer, callsEach } = require('./util');

describe('startTest', () => {
	it('can mock inner call', () =>
		startTest(outer)
			.args('zzz')
			.awaitsCall(inner, 'zzz')
			.callReturns('mock inner zzz1')
			.awaitsCall(inner, 'mock inner zzz1')
			.callReturns('mock inner zzz2')
			.returns('outer: mock inner zzz2'));
	it('can mock inner call in bulk', () =>
		startTest(outer)
			.args('zzz')
			.awaitsAllCalls([
				{ fn: inner, args: ['zzz'], returns: 'mock inner zzz1' },
				{ fn: inner, args: ['mock inner zzz1'], returns: 'mock inner zzz2' }
			])
			.returns('outer: mock inner zzz2'));
	it('can mock errors', () =>
		startTest(outer)
			.args('yyy')
			.awaitsCall(inner, 'yyy')
			.callThrows(new Error('broke'))
			.throws(new Error('rethrow broke')));
	it('fail on error of incorrect type', () => {
		function TempE(m) {
			this.message = m;
		}
		inherits(TempE, Error);
		return startTest(outer)
			.args('yyy')
			.awaitsCall(inner, 'yyy')
			.callThrows(new Error('tempe-error'))
			.throws(new TempE('tempe-error'))
			.catch(err => {
				if (err.message !== 'Error must be instance of TempE') {
					throw err;
				}
			});
	});
	it('can check thrown non-errors', () =>
		startTest(outer)
			.args('yyy')
			.awaitsCall(inner, 'yyy')
			.callThrows('broke')
			.throws('broke'));
	it('can check thrown extended error types', () => {
		const err = new assert.AssertionError({ message: 'fail' });
		const err2 = new assert.AssertionError({ message: 'rethrow fail' });
		return startTest(outer)
			.args('yyy')
			.awaitsCall(inner, 'yyy')
			.callThrows(err)
			.throws(err2);
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
		return startTest(outer, testConfig)
			.args('xxx')
			.awaitsCall(inner, 'xxx')
			.callReturns('mock inner xxx')
			.awaitsCall(inner, 'mock inner xxx')
			.callThrows(err)
			.throws(new Error('rethrow busted'))
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
			startTest(outer)
				.args('www')
				.awaitsCall(inner, 'www')
				.callReturns('mock inner www1')
				.awaitsCall('whoops', 'mock inner www1')
				.callReturns('mock inner www2')
				.returns('outer: mock inner www2')
				.throw(new Error('should not run'));
			throw new Error('should have thrown');
		} catch (ex) {
			if (ex.message !== '.awaitsCall(fn, ...args) requires first argument as function') {
				throw ex;
			}
		}
	});
	it('will throw if mock stack too short', () =>
		startTest(outer)
			.args('vvv')
			.awaitsCall(inner, 'vvv')
			.callReturns('mock inner vvv1')
			.returns('outer: mock inner vvv1')
			.then(r => assert.fail(r, null, 'Should have thrown'))
			.catch(err => {
				if (err.message !== '#2: Unexpected call(inner), no more calls expected') {
					throw err;
				}
			}));
	it('will throw if mock stack too long', () =>
		startTest(outer)
			.args('uuu')
			.awaitsCall(inner, 'uuu')
			.callReturns('mock inner uuu1')
			.awaitsCall(inner, 'mock inner uuu1')
			.callReturns('mock inner uuu2')
			.awaitsCall(outer, 'mock inner uuu2')
			.callReturns('mock outer uuu3')
			.awaitsCall(inner, 'mock outer uuu3')
			.callReturns('mock inner uuu4')
			.returns('outer: mock inner uuu2')
			.then(r => assert.fail(r, null, 'Should have thrown'))
			.catch(err => {
				if (err.message !== 'Expected additional calls: outer(), inner()') {
					throw err;
				}
			}));
	it('will fail if thrown error does not match', () =>
		startTest(outer)
			.args('ttt')
			.awaitsCall(inner, 'ttt')
			.callThrows(new Error('broke'))
			.throws(new Error('wrong error'))
			.then(r => assert.fail(r, null, 'Should have thrown'))
			.catch(err => {
				if (
					!(
						err instanceof assert.AssertionError &&
						err.actual === 'rethrow broke' &&
						err.expected === 'wrong error'
					)
				) {
					throw err;
				}
			}));
	it('will fail if thrown but return expected', () =>
		startTest(outer)
			.args('sss')
			.awaitsCall(inner, 'sss')
			.callReturns('mock inner sss1')
			.awaitsCall(inner, 'mock inner sss1')
			.callReturns('mock inner sss2')
			.throws(new Error('will fail'))
			.then(r => assert.fail(r, null, 'Should have thrown'))
			.catch(err => {
				if (err.message !== 'Returned data, but should have thrown') {
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
		return startTest(eatIt)
			.args('rrr')
			.awaitsCall(outer, 'rrr')
			.callReturns('mock inner rrr1')
			.returns('mock inner rrr1')
			.then(r => assert.fail(r, null, 'Should have thrown'))
			.catch(err => {
				if (err.message !== '#1: Unexpected call(inner), expected call(outer)') {
					throw err;
				}
			});
	});
	it('will pass-thru unexpected errors', () => {
		async function throwIt(call, x) {
			await call(inner, x);
			throw new Error('throw-it');
		}
		return startTest(throwIt)
			.args('qqq')
			.awaitsCall(inner, 'qqq')
			.callReturns('mock inner qqq1')
			.returns('never checked')
			.then(r => assert.fail(r, null, 'Should have thrown'))
			.catch(err => {
				if (err.message !== 'throw-it') {
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
		return startTest(callsPi)
			.args()
			.awaitsCall(pi, 159)
			.callReturns('pi')
			.returns('pi');
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
		return startTest(usesCallback)
			.args()
			.awaitsCall(someAction, 'callback')
			.callReturns('mock callback')
			.awaitsCall(someAction, 'callback2')
			.callReturns(['mock callback2'])
			.returns(['mock callback', ['mock callback2']]);
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
		return startTest(usesCallback)
			.args()
			.awaitsCall(someAction, 'callback')
			.callThrows(new Error('1st error'))
			.awaitsCall(someAction, 'callback2')
			.callThrows(new Error('2nd error'))
			.returns(['1st error', '2nd error']);
	});
	it('can test calls to sync functions', () => {
		function pi(x) {
			return [3.14, x];
		}
		function callsPi(call) {
			const x = call.sync(pi, 159);
			return x[1];
		}
		return startTest(callsPi)
			.args()
			.awaitsCall(pi, 159)
			.callReturns(['fake', 'value'])
			.returns('value');
	});
	it('can resolve Promise.all methods with .awaitsAllCalls()', () => {
		const callGroup = [
			{ fn: inner, args: ['a'], returns: '(inner a)' },
			{ fn: inner, args: ['b'], returns: '(inner b)' }
		];
		return startTest(callsEach)
			.args()
			.awaitsCall(inner, '_')
			.callReturns('(inner _)')
			.awaitsAllCalls(callGroup)
			.returns(['static', '(inner a)', '(inner b)']);
	});
	it('can reject Promise.all methods with .awaitsAllCalls()', () => {
		const callGroup = [
			{ fn: inner, args: ['a'], returns: null },
			{ fn: inner, args: ['b'], throws: new Error('fail') }
		];
		return startTest(callsEach)
			.args()
			.awaitsCall(inner, '_')
			.callReturns('(inner _)')
			.awaitsAllCalls(callGroup)
			.throws(new Error('fail'));
	});
	it('will handle non-array args in .awaitsAllCalls()', () => {
		const callGroup = [
			{ fn: inner, args: 'a', returns: '(inner a)' },
			{ fn: inner, args: 'b', returns: '(inner b)' }
		];
		return startTest(callsEach)
			.args()
			.awaitsCall(inner, '_')
			.callReturns('(inner _)')
			.awaitsAllCalls(callGroup)
			.returns(['static', '(inner a)', '(inner b)']);
	});
	it('will handle zero args calls in .awaitsAllCalls()', () => {
		function callInner(call) {
			return call(inner);
		}
		const callGroup = [{ fn: inner, returns: '(inner undefined)' }];
		return startTest(callInner)
			.args()
			.awaitsAllCalls(callGroup)
			.returns('(inner undefined)');
	});
});
