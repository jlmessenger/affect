// All internal test validations are made using assert-style calls.
// This shim enables detailed error messages in jest/expect style test-runners.
// This ensures that error outputs are formatted nicely in both mocha and jest.
const assert = require('assert');
const usingJest = typeof expect !== 'undefined' && expect.extend && expect.anything;

function runExpect(msg, chain, e) {
	try {
		chain(e);
	} catch (ex) {
		if (msg) {
			ex.message = `${msg}\n${ex.message}`;
		}
		const i = ex.stack.indexOf('    at ');
		/* istanbul ignore else */
		if (i >= 0) {
			const preamble = ex.stack.substring(0, i);
			const trace = ex.stack
				.substring(i)
				.split('\n')
				.slice(2)
				.join('\n');
			ex.stack = `${preamble}${trace}`;
		}
		throw ex;
	}
}

const fauxAssert = {
	strictEqual(a, e, msg) {
		runExpect(msg, expect(a).toBe, e);
	},
	deepStrictEqual(a, e, msg) {
		runExpect(msg, expect(a).toEqual, e);
	},
	ok(a, msg) {
		runExpect(msg, expect(a).toBeTruthy);
	},
	fail(a, e, msg) {
		// ensure .fail always throws
		/* istanbul ignore next */
		const chain = a === e ? expect(a).not : expect(a);
		runExpect(msg, chain.toBe, e);
	},
	throws(fn, errCheck) {
		runExpect(undefined, expect(fn).toThrow, errCheck);
	},
	AssertionError: assert.AssertionError
};

/* istanbul ignore next */
module.exports = usingJest ? fauxAssert : assert;
