const assert = require('assert');
const startTest = require('../test');

function methodCalled(call, x) {
	return `called ${x}`;
}
function methodBeingTested(call) {
	return call(methodCalled, 'ok');
}

describe('startTest failures', () => {
	it('fail on .awaitsCall() wrong arguments', () => startTest(methodBeingTested)
		.args('a', 'b')
		.awaitsCall(methodCalled, 'wrong') // <- fail
		.callReturns('mock')
		.returns('mock')
		.then(r => assert.fail(r, null, 'Should have thrown'))
		.catch((err) => {
			if (err.message !== '#1: Unexpected arguments for methodCalled()') {
				throw err;
			}
		})
	);
	it('fail on missing .callReturns/.callThrows', () => {
		assert.throws(() => startTest(methodBeingTested)
			.args('a', 'b')
			.awaitsCall(methodCalled, 'ok') // <-- fail
			.returns('mock')
		, /\.returns\(data\) can only come after \.callReturns\(\) or \.callThrows\(\)/);
	});
	it('fail on missing fail on double .callReturns/.callThrows', () => {
		assert.throws(() => startTest(methodBeingTested)
			.args('a', 'b')
			.awaitsCall(methodCalled, 'ok')
			.callThrows(new Error('error'))
			.callReturns('mock') // <-- fail
			.returns('mock')
		, /\.callReturns\(data\) can only come after \.awaitsCall\(\)/);
	});
	it('fail on missing fail on double .awaitsCall', () => {
		assert.throws(() => startTest(methodBeingTested)
			.args('a', 'b')
			.awaitsCall(methodCalled, 'ok')
			.awaitsCall(methodCalled, 'ok') // <-- fail
			.callReturns('mock')
			.returns('mock')
		, /\.awaitsCall\(fn, \.\.\.args\) can only come after \.callReturns\(\) or \.callThrows\(\)/);
	});
	it('fail on missing .args', () => {
		assert.throws(() => startTest(methodBeingTested)
			.awaitsCall(methodCalled, 'ok') // <-- fail
			.callThrows('mock')
			.returns('mock')
		, /\.args\(\.\.\.args\) must be called before \.awaitsCall\(\)/);
	});
	it('fail on .awaitsCall missing function', () => {
		assert.throws(() => startTest(methodBeingTested)
			.args('a', 'b')
			.awaitsCall('a') // <- fail
			.callReturns('mock')
			.returns('mock')
		, /\.awaitsCall\(fn, \.\.\.args\) requires first argument as function/);
	});
	it('fail on .startTest not a function', () => {
		assert.throws(() => startTest(0) // <-- fail
			.args('a', 'b')
			.awaitsCall(methodCalled, 'ok')
			.callReturns('mock')
			.returns('mock')
		, /startTest\(fn\) requires a function argument/);
	});
});
