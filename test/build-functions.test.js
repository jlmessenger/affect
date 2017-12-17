/* eslint-disable newline-per-chained-call */
const assert = require('assert');

const { buildFunctions, startTest } = require('../lib');
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
			.delay(0) // ensure event handers are called
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
});
