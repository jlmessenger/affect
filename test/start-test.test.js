/* eslint-disable newline-per-chained-call */
const assert = require('assert');

const { startTest } = require('../');
const { inner, outer } = require('./util');

describe('startTest', () => {
	it('can mock inner call', () => startTest(outer)
		.args('zzz')
		.awaitsCall(inner, 'zzz').callReturns('mock inner zzz1')
		.awaitsCall(inner, 'mock inner zzz1').callReturns('mock inner zzz2')
		.returns('outer: mock inner zzz2')
	);
	it('can mock errors', () => startTest(outer)
		.args('yyy')
		.awaitsCall(inner, 'yyy').callThrows(new Error('broke'))
		.throws(new Error('rethrow broke'))
	);
	it('emits events when configured', () => {
		const events = [];
		const err = new Error('busted');
		return startTest(outer)
			.onCall(({ fn, args }) => {
				events.push({ event: 'onCall', fnName: fn.name, args });
			})
			.onCallComplete(({ fn, args, success }) => {
				events.push({ event: 'onCallComplete', fnName: fn.name, args, success });
			})
			.args('xxx')
			.awaitsCall(inner, 'xxx').callReturns('mock inner xxx')
			.awaitsCall(inner, 'mock inner xxx').callThrows(err)
			.throws(new Error('rethrow busted'))
			.then(() => {
				assert.deepEqual(events, [
					{ event: 'onCall', fnName: 'outer', args: ['xxx'] },
					{ event: 'onCall', fnName: 'mockReturn', args: ['inner', 'mock inner xxx'] },
					{ event: 'onCallComplete', fnName: 'mockReturn', args: ['inner', 'mock inner xxx'], success: true },
					{ event: 'onCall', fnName: 'mockThrow', args: ['inner', err] },
					{ event: 'onCallComplete', fnName: 'mockThrow', args: ['inner', err], success: false },
					{ event: 'onCallComplete', fnName: 'outer', args: ['xxx'], success: false }
				]);
			});
	});
	it('will throw if fn arg is wrong', () => {
		try {
			startTest(outer)
				.args('www')
				.awaitsCall(inner, 'www').callReturns('mock inner www1')
				.awaitsCall('whoops', 'mock inner www1').callReturns('mock inner www2')
				.returns('outer: mock inner www2')
				.throw(new Error('should not run'));
			throw new Error('should have thrown');
		} catch (ex) {
			if (ex.message !== 'awaitsCall() must be a function, got: whoops') {
				throw ex;
			}
		}
	});
	it('will throw if mock stack too short', () => startTest(outer)
		.args('vvv')
		.awaitsCall(inner, 'vvv').callReturns('mock inner vvv1')
		.returns('outer: mock inner vvv1')
		.then(r => assert.strictEqual(Symbol('THROW'), r, 'Should have thrown'))
		.catch((err) => {
			if (err.message !== '#2: Unexpected call(inner), no more calls expected') {
				throw err;
			}
		})
	);
	it('will throw if mock stack too long', () => startTest(outer)
		.args('uuu')
		.awaitsCall(inner, 'uuu').callReturns('mock inner uuu1')
		.awaitsCall(inner, 'mock inner uuu1').callReturns('mock inner uuu2')
		.awaitsCall(outer, 'mock inner uuu2').callReturns('mock outer uuu3')
		.awaitsCall(inner, 'mock outer uuu3').callReturns('mock inner uuu4')
		.returns('outer: mock inner uuu2')
		.then(r => assert.strictEqual(Symbol('THROW'), r, 'Should have thrown'))
		.catch((err) => {
			if (err.message !== 'Expected additional calls: outer(), inner()') {
				throw err;
			}
		})
	);
	it('will fail if thrown error does not match', () => startTest(outer)
		.args('ttt')
		.awaitsCall(inner, 'ttt').callThrows(new Error('broke'))
		.throws(new Error('wrong error'))
		.then(r => assert.strictEqual(Symbol('THROW'), r, 'Should have thrown'))
		.catch((err) => {
			// FIXME: better AssertionError predicate
			if (err.message !== '\'rethrow broke\' === \'wrong error\'') {
				throw err;
			}
		})
	);
	it('will fail if thrown but return expected', () => startTest(outer)
		.args('sss')
		.awaitsCall(inner, 'sss').callReturns('mock inner sss1')
		.awaitsCall(inner, 'mock inner sss1').callReturns('mock inner sss2')
		.throws(new Error('will fail'))
		.then(r => assert.strictEqual(Symbol('THROW'), r, 'Should have thrown'))
		.catch((err) => {
			if (err.message !== 'Returned data, but should have thrown') {
				throw err;
			}
		})
	);
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
			.awaitsCall(outer, 'rrr').callReturns('mock inner rrr1')
			.returns('mock inner rrr1')
			.then(r => assert.strictEqual(Symbol('THROW'), r, 'Should have thrown'))
			.catch((err) => {
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
			.awaitsCall(inner, 'qqq').callReturns('mock inner qqq1')
			.returns('never checked')
			.then(r => assert.strictEqual(Symbol('THROW'), r, 'Should have thrown'))
			.catch((err) => {
				if (err.message !== 'throw-it') {
					throw err;
				}
			});
	});
	it('can test calls to plain functions', () => {
		function pi(x) {
			return [3.14, x];
		}
		function callsPi(call) {
			return call.plain(pi, 159);
		}
		return startTest(callsPi)
			.args()
			.awaitsCall(pi, 159).callReturns('pi')
			.returns('pi');
	});
});
