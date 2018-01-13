const { inner, outer, delay } = require('../util.js');

function methodCalled(call, x) {
	return `called ${x}`;
}
function methodBeingTested(call) {
	return call(methodCalled, 'ok');
}

module.exports = function({ assert, affectTest }) {
	describe('affectTest failures', () => {
		it('fail on .calls() wrong arguments', () =>
			affectTest(methodBeingTested)
				.args('a', 'b')
				.calls(methodCalled, 'wrong') // <- fail
				.callReturns('mock')
				.expectsReturn('mock')
				.then(r => assert.fail(r, null, 'Should have thrown'))
				.catch(err => {
					if (!/#1: Unexpected arguments for methodCalled\(\)/.test(err.message)) {
						throw err;
					}
				}));
		it('fail on missing .callReturns/.callThrows', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.args('a', 'b')
						.calls(methodCalled, 'ok') // <-- fail
						.expectsReturn('mock'),
				/\.expectsReturn\(data\) can only come after \.callReturns\(\) or \.callThrows\(\)/
			);
		});
		it('fail on missing fail on double .callReturns/.callThrows', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.args('a', 'b')
						.calls(methodCalled, 'ok')
						.callThrows(new Error('error'))
						.callReturns('mock') // <-- fail
						.expectsReturn('mock'),
				/\.callReturns\(data\) can only come after \.calls\(\)/
			);
		});
		it('fail on missing fail on double .calls', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.args('a', 'b')
						.calls(methodCalled, 'ok')
						.calls(methodCalled, 'ok') // <-- fail
						.callReturns('mock')
						.expectsReturn('mock'),
				/\.calls\(fn, \.\.\.args\) can only come after \.callReturns\(\) or \.callThrows\(\)/
			);
		});
		it('fail on missing fail on double .callsAll', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.args('a', 'b')
						.calls(methodCalled, 'ok')
						.callsAll([{ fn: methodCalled, args: ['ok'], returns: 'mock' }]) // <-- fail
						.expectsReturn('mock'),
				/\.callsAll\(\[\{fn, args, returns\/throws\}, \.\.\.\]\) can only come after \.callReturns\(\) or \.callThrows\(\)/
			);
		});
		it('fail on missing .args before .calls', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.calls(methodCalled, 'ok') // <-- fail
						.callThrows('mock')
						.expectsReturn('mock'),
				/\.args\(\.\.\.args\) must be called before \.calls\(\)/
			);
		});
		it('fail on missing .args before .callsAll', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.callsAll(methodCalled, 'ok') // <-- fail
						.callThrows('mock')
						.expectsReturn('mock'),
				/\.args\(\.\.\.args\) must be called before \.callsAll\(\)/
			);
		});
		it('fail on .calls missing function', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.args('a', 'b')
						.calls('a') // <- fail
						.callReturns('mock')
						.expectsReturn('mock'),
				/\.calls\(fn, \.\.\.args\) requires first argument as function/
			);
		});
		it('fail on .affectTest not a function', () => {
			assert.throws(
				() =>
					affectTest(0) // <-- fail
						.args('a', 'b')
						.calls(methodCalled, 'ok')
						.callReturns('mock')
						.expectsReturn('mock'),
				/affectTest\(fn\) requires a function argument/
			);
		});
		it('fail on .callsAll not array', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.args('a', 'b')
						.callsAll('bad') // <-- fail
						.expectsReturn('mock'),
				/\.callsAll\(\[\{fn, args, returns\/throws}, \.\.\.\]\) requires non-empty array argument/
			);
		});
		it('fail on .callsAll {fn: } is not a function', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.args('a', 'b')
						.callsAll([{ fn: 'x', returns: 'mock' }]) // <-- fail
						.expectsReturn('mock'),
				/\.callsAll\(\[\{fn, args, returns\/throws\}, \.\.\.\]\) requires argument\[0\]\.fn as a function/
			);
		});
		it('fail on .callsAll missing returns or throws', () => {
			assert.throws(
				() =>
					affectTest(methodBeingTested)
						.args('a', 'b')
						.callsAll([{ fn: methodCalled, args: ['ok'] }]) // <-- fail
						.expectsReturn('mock'),
				/\.callsAll\(\[\{fn, args, returns\/throws\}, \.\.\.\]\) requires argument\[0\] must have property \{returns: data\} or \{throws: error\}/
			);
		});
	});
};
