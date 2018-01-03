const assert = require('assert');
const startTest = require('../test');

function methodCalled(call, x) {
	return `called ${x}`;
}
function methodBeingTested(call) {
	return call(methodCalled, 'ok');
}

describe('startTest failures', () => {
	it('fail on .awaitsCall() wrong arguments', () =>
		startTest(methodBeingTested)
			.args('a', 'b')
			.awaitsCall(methodCalled, 'wrong') // <- fail
			.callReturns('mock')
			.returns('mock')
			.then(r => assert.fail(r, null, 'Should have thrown'))
			.catch(err => {
				if (err.message !== '#1: Unexpected arguments for methodCalled()') {
					throw err;
				}
			}));
	it('fail on missing .callReturns/.callThrows', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.args('a', 'b')
					.awaitsCall(methodCalled, 'ok') // <-- fail
					.returns('mock'),
			/\.returns\(data\) can only come after \.callReturns\(\) or \.callThrows\(\)/
		);
	});
	it('fail on missing fail on double .callReturns/.callThrows', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.args('a', 'b')
					.awaitsCall(methodCalled, 'ok')
					.callThrows(new Error('error'))
					.callReturns('mock') // <-- fail
					.returns('mock'),
			/\.callReturns\(data\) can only come after \.awaitsCall\(\)/
		);
	});
	it('fail on missing fail on double .awaitsCall', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.args('a', 'b')
					.awaitsCall(methodCalled, 'ok')
					.awaitsCall(methodCalled, 'ok') // <-- fail
					.callReturns('mock')
					.returns('mock'),
			/\.awaitsCall\(fn, \.\.\.args\) can only come after \.callReturns\(\) or \.callThrows\(\)/
		);
	});
	it('fail on missing fail on double .awaitsAllCalls', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.args('a', 'b')
					.awaitsCall(methodCalled, 'ok')
					.awaitsAllCalls([{ fn: methodCalled, args: ['ok'], returns: 'mock' }]) // <-- fail
					.returns('mock'),
			/\.awaitsAllCalls\(\[\{fn, args, returns\/throws\}, \.\.\.\]\) can only come after \.callReturns\(\) or \.callThrows\(\)/
		);
	});
	it('fail on missing .args before .awaitsCall', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.awaitsCall(methodCalled, 'ok') // <-- fail
					.callThrows('mock')
					.returns('mock'),
			/\.args\(\.\.\.args\) must be called before \.awaitsCall\(\)/
		);
	});
	it('fail on missing .args before .awaitsAllCalls', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.awaitsAllCalls(methodCalled, 'ok') // <-- fail
					.callThrows('mock')
					.returns('mock'),
			/\.args\(\.\.\.args\) must be called before \.awaitsAllCalls\(\)/
		);
	});
	it('fail on .awaitsCall missing function', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.args('a', 'b')
					.awaitsCall('a') // <- fail
					.callReturns('mock')
					.returns('mock'),
			/\.awaitsCall\(fn, \.\.\.args\) requires first argument as function/
		);
	});
	it('fail on .startTest not a function', () => {
		assert.throws(
			() =>
				startTest(0) // <-- fail
					.args('a', 'b')
					.awaitsCall(methodCalled, 'ok')
					.callReturns('mock')
					.returns('mock'),
			/startTest\(fn\) requires a function argument/
		);
	});
	it('fail on .awaitsAllCalls not array', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.args('a', 'b')
					.awaitsAllCalls('bad') // <-- fail
					.returns('mock'),
			/\.awaitsAllCalls\(\[\{fn, args, returns\/throws}, \.\.\.\]\) requires non-empty array argument/
		);
	});
	it('fail on .awaitsAllCalls {fn: } is not a function', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.args('a', 'b')
					.awaitsAllCalls([{ fn: 'x', returns: 'mock' }]) // <-- fail
					.returns('mock'),
			/\.awaitsAllCalls\(\[\{fn, args, returns\/throws\}, \.\.\.\]\) requires argument\[0\]\.fn as a function/
		);
	});
	it('fail on .awaitsAllCalls missing returns or throws', () => {
		assert.throws(
			() =>
				startTest(methodBeingTested)
					.args('a', 'b')
					.awaitsAllCalls([{ fn: methodCalled, args: ['ok'] }]) // <-- fail
					.returns('mock'),
			/\.awaitsAllCalls\(\[\{fn, args, returns\/throws\}, \.\.\.\]\) requires argument\[0\] must have property \{returns: data\} or \{throws: error\}/
		);
	});
});
