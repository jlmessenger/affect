const assert = require('assert');

const { buildFunctions } = require('../');
const { inner, outer } = require('./util');

describe('buildFunctions', () => {
	it('partially applies call argument', () => {
		const functions = buildFunctions({ outer });
		return functions.outer('aaa')
			.then(out => assert.strictEqual(out, 'outer: (inner (inner aaa))'));
	});
	it('emits events when configured', () => {
		const events = [];
		const functions = buildFunctions({ outer }, {
			onCall({ fn, args }) {
				events.push({ event: 'onCall', fn, args });
			},
			onCallComplete({ fn, args, success }) {
				events.push({ event: 'onCallComplete', fn, args, success });
			}
		});
		return functions.outer('bbb')
			.then(x => x) // ensure event handers are called
			.then((out) => {
				assert.strictEqual(out, 'outer: (inner (inner bbb))');
				assert.deepEqual(events, [
					{ event: 'onCall', fn: outer, args: ['bbb'] },
					{ event: 'onCall', fn: inner, args: ['bbb'] },
					{ event: 'onCallComplete', fn: inner, args: ['bbb'], success: true },
					{ event: 'onCall', fn: inner, args: ['(inner bbb)'] },
					{ event: 'onCallComplete', fn: inner, args: ['(inner bbb)'], success: true },
					{ event: 'onCallComplete', fn: outer, args: ['bbb'], success: true }
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
		const functions = buildFunctions({ callsPi });
		return functions.callsPi()
			.then(out => assert.deepEqual(out, [3.14, 159]));
	});
});
