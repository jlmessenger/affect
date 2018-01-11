const { inner, outer, delay } = require('../util.js');

module.exports = function({ assert, affect }) {
	describe('affect', () => {
		it('partially applies call argument', () => {
			const functions = affect({ outer });
			return functions
				.outer('aaa')
				.then(out => assert.strictEqual(out, 'outer: (inner (inner aaa))'));
		});
		it('emits events when configured', () => {
			const events = [];
			const functions = affect(
				{ outer },
				{
					onCall({ fn, args }) {
						events.push({ event: 'onCall', fn, args });
					},
					onCallComplete({ fn, args, success }) {
						events.push({ event: 'onCallComplete', fn, args, success });
					},
					onFunction({ fn, args }) {
						events.push({ event: 'onFunction', fn, args });
					},
					onFunctionComplete({ fn, args, success }) {
						events.push({ event: 'onFunctionComplete', fn, args, success });
					}
				}
			);
			return functions
				.outer('bbb')
				.then(delay(2)) // ensure event handers are called
				.then(out => {
					assert.strictEqual(out, 'outer: (inner (inner bbb))');
					assert.deepStrictEqual(events, [
						{ event: 'onFunction', fn: outer, args: ['bbb'] },
						{ event: 'onCall', fn: inner, args: ['bbb'] },
						{ event: 'onCallComplete', fn: inner, args: ['bbb'], success: true },
						{ event: 'onCall', fn: inner, args: ['(inner bbb)'] },
						{
							event: 'onCallComplete',
							fn: inner,
							args: ['(inner bbb)'],
							success: true
						},
						{
							event: 'onFunctionComplete',
							fn: outer,
							args: ['bbb'],
							success: true
						}
					]);
				});
		});
		it('can call normal functions', () => {
			function pi(x) {
				return [3.14, x];
			}
			function callsPi(call) {
				return call.plain(pi, 159);
			}
			const functions = affect({ callsPi });
			return functions.callsPi().then(out => assert.deepStrictEqual(out, [3.14, 159]));
		});
		it('can use callback based methods', () => {
			function someAction(a, cb) {
				if (a === false) {
					setImmediate(cb, new Error('error'));
					return;
				}
				const results = new Array(a).fill().map((x, i) => i + 1);
				setImmediate(cb, null, ...results);
			}
			function doAction(call) {
				return Promise.all([
					call
						.fromCb(someAction, false)
						.then(r => assert.fail(r, null, 'Should have thrown'))
						.catch(err => err),
					call.fromCb(someAction, 0),
					call.fromCb(someAction, 1),
					call.multiCb(someAction, 5)
				]);
			}
			const functions = affect({ doAction });
			return functions.doAction().then(out => {
				assert.strictEqual(out.length, 4, 'Expected 3 entries');
				if (!out[0] || out[0].message !== 'error') {
					throw out[0];
				}
				assert.strictEqual(out[1], undefined, 'No callback argument has undefined result');
				assert.strictEqual(out[2], 1, 'Single callback argument has single result');
				assert.deepStrictEqual(out[3], [1, 2, 3, 4, 5], 'Multi callback argument has array result');
			});
		});
		it('can call sync methods', () => {
			function simple(fail) {
				if (fail) {
					throw new Error('failed');
				}
				return 'sync';
			}
			function getSimple(call, fail) {
				return call.sync(simple, fail);
			}
			const functions = affect({ getSimple });
			return functions
				.getSimple(false)
				.then(out => {
					assert.strictEqual(out, 'sync');
					return functions.getSimple(true);
				})
				.then(r => assert.fail(r, null, 'Should have thrown'))
				.catch(err => {
					if (err.message !== 'failed') {
						throw err;
					}
				});
		});
		it('call read context', () => {
			function usesContext(call) {
				return call.context.value + call.context.unchanged;
			}
			const functions = affect({ usesContext }, { context: { value: 1, unchanged: 10 } });
			return Promise.all([
				functions.usesContext(),
				functions.usesContext.withContext({ value: -5 })
			]).then(([eleven, five]) => {
				assert.strictEqual(eleven, 11);
				assert.strictEqual(five, 5);
			});
		});
	});
};
