const assert = require('assert');
const affect = require('./affect');
const affectTest = require('./test');

function plainMethod(a) {
	return `plain: ${a}`;
}
class MyClass {
	constructor() {}
	doThing(a) {
		return `MyClass.doThing: ${a}`;
	}
}
const instance = new MyClass();
function affectMethod(call, a) {
	return Promise.resolve(`affect: ${a}`);
}
function withCb(a, cb) {
	setTimeout(() => cb(null, `cb: ${a}`), 0);
}

async function mainMethod(call, a, b, c, d, e) {
	const v = await call(affectMethod, a);
	const w = call.plain(plainMethod, b);
	const x = call.bound(instance, 'doThing', c);
	const y = await call.fromCb(withCb, d);
	const [z] = await call.multiCb(withCb, e);
	return [v, w, x, y, z];
}

function isErr(msg) {
	return err => {
		if (err.message !== msg) {
			throw err;
		}
	};
}
function shouldThrow() {
	assert.fail('should have thrown');
}

describe('affectTest', () => {
	it('uses each interface', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callResolves('v')
			.calls(plainMethod, 'b')
			.callReturns('w')
			.callsBound(instance, 'doThing', 'c')
			.callReturns('x')
			.calls(withCb, 'd')
			.callResolves('y')
			.calls(withCb, 'e')
			.callResolves('z')
			.expectsReturn(['v', 'w', 'x', 'y', 'z']));
	it('use run', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callResolves('v')
			.calls(plainMethod, 'b')
			.callReturns('w')
			.callsBound(instance, 'doThing', 'c')
			.callReturns('x')
			.calls(withCb, 'd')
			.callResolves('y')
			.calls(withCb, 'e')
			.callResolves('z')
			.run()
			.then(out => assert.deepStrictEqual(out, ['v', 'w', 'x', 'y', 'z'])));
	it('complains of bound when calls', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.callsBound(instance, 'doThing', 'a')
			.callReturns('v')
			.run()
			.then(shouldThrow)
			.catch(isErr('#1 test expected call.bound(<MyClass>, doThing), but actually got call(affectMethod)')));
	it('complains of calls when call.bound', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callResolves('v')
			.calls(plainMethod, 'b')
			.callReturns('w')
			.calls(withCb, 'c')
			.callResolves('x')
			.run()
			.then(shouldThrow)
			.catch(isErr('#3 test expected call to withCb, but actually got call.bound(<MyClass>, doThing)')));
	it('can throw', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callThrows(new Error('problem'))
			.expectsThrow(new Error('problem')));
	it('can reject', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callRejects(new Error('problem'))
			.expectsThrow(new Error('problem')));
	it('can throw non-error type', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callThrows({ error: 'problem' })
			.expectsThrow({ error: 'problem' }));
	it('can pass-thru thrown error', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callThrows(new Error('problem'))
			.run()
			.then(shouldThrow)
			.catch(isErr('problem')));
	it('will fail if returns when throw expected', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callResolves('v')
			.calls(plainMethod, 'b')
			.callReturns('w')
			.callsBound(instance, 'doThing', 'c')
			.callReturns('x')
			.calls(withCb, 'd')
			.callReturns('y')
			.calls(withCb, 'e')
			.callReturns('z')
			.expectsThrow(new Error("won't match"))
			.then(shouldThrow)
			.catch(isErr('test expects throw, but method resolved without error')));
	it('can pass-thru error when return is expected', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callThrows(new Error('problem'))
			.expectsReturn("doesn't matter")
			.then(shouldThrow)
			.catch(isErr('problem')));
	it('fails if test chain is short', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callResolves('v')
			.expectsReturn("doesn't matter")
			.then(shouldThrow)
			.catch(
				isErr('test specified 1 calls but actual method made 2 or more calls: #2 should be call.plain(plainMethod)')
			));
	it('fails if test chain is short', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callResolves('v')
			.calls(plainMethod, 'b')
			.callReturns('w')
			.expectsReturn("doesn't matter")
			.then(shouldThrow)
			.catch(
				isErr(
					'test specified 2 calls but actual method made 3 or more calls: #3 should be call.bound(<MyClass>, doThing)'
				)
			));
	it('fails is test chain is too long', () =>
		affectTest(mainMethod)
			.args('a', 'b', 'c', 'd', 'e')
			.calls(affectMethod, 'a')
			.callResolves('v')
			.calls(plainMethod, 'b')
			.callReturns('w')
			.callsBound(instance, 'doThing', 'c')
			.callReturns('x')
			.calls(withCb, 'd')
			.callResolves('y')
			.calls(withCb, 'e')
			.callResolves('z')
			.calls(affectMethod, 'f')
			.callResolves("doesn't matter")
			.expectsReturn(['v', 'w', 'x', 'y', 'z'])
			.then(shouldThrow)
			.catch(isErr('test expects 6 calls, but actual method only made 5 calls')));
	it('can name old-style static class methods', () => {
		function OtherClass() {}
		OtherClass.staticMethod = function() {};
		function main(call) {
			return call.bound(OtherClass, 'staticMethod');
		}
		return affectTest(main)
			.args()
			.calls(main)
			.callReturns('ok')
			.expectsReturn("doesn't matter")
			.then(shouldThrow)
			.catch(isErr('#1 test expected call to main, but actually got call.bound(<OtherClass>, staticMethod)'));
	});
	it('can name plain object methods', () => {
		const instance = {
			method: function() {}
		};
		function main(call) {
			return call.bound(instance, 'method');
		}
		return affectTest(main)
			.args()
			.calls(main)
			.callReturns('ok')
			.expectsReturn("doesn't matter")
			.then(shouldThrow)
			.catch(isErr('#1 test expected call to main, but actually got call.bound(<Object>, method)'));
	});
	it('can handle errors caught by method', () => {
		async function main(call) {
			let o;
			try {
				await call(main, 'a');
			} catch (err) {
				o = err.message;
			}
			await call(main, 'b');
			return o;
		}
		return affectTest(main)
			.args()
			.calls(main, 'WRONG')
			.callResolves('v')
			.calls(main, 'b')
			.callResolves('w')
			.expectsReturn("doesn't matter")
			.then(shouldThrow)
			.catch(isErr('#1 arguments for call(main) did not match those specified in test'));
	});
	it('only uses first errors caught by test', () => {
		async function main(call) {
			let o;
			try {
				await call(main, 'a');
			} catch (err) {
				o = err.message;
			}
			await call(main, 'b');
			return o;
		}
		return affectTest(main)
			.args()
			.calls(main, 'WRONG')
			.callResolves('v')
			.calls(main, 'WRONG2')
			.callResolves('w')
			.expectsReturn("doesn't matter")
			.then(shouldThrow)
			.catch(isErr('#1 arguments for call(main) did not match those specified in test'));
	});
});
describe('affect', () => {
	it('calls real methods', async () => {
		const funcs = affect({ mainMethod });
		const out = await funcs.mainMethod('a', 'b', 'c', 'd', 'e');
		assert.deepStrictEqual(out, ['affect: a', 'plain: b', 'MyClass.doThing: c', 'cb: d', 'cb: e']);
	});
	it('passes-thru non methods', async () => {
		const funcs = affect({
			top: true,
			nested: { mainMethod, child: 'yes', array: ['a'] }
		});
		assert.strictEqual(funcs.top, true);
		assert.strictEqual(funcs.nested.child, 'yes');
		assert.deepStrictEqual(funcs.nested.array, ['a']);
		const out = await funcs.nested.mainMethod('a', 'b', 'c', 'd', 'e');
		assert.deepStrictEqual(out, ['affect: a', 'plain: b', 'MyClass.doThing: c', 'cb: d', 'cb: e']);
	});
	it('handles callback rejection', () => {
		function errCb(cb) {
			setTimeout(() => cb(new Error('problem')), 0);
		}
		async function main(call) {
			await call.fromCb(errCb);
		}
		const funcs = affect({ main });
		return funcs
			.main()
			.then(shouldThrow)
			.catch(isErr('problem'));
	});
	it('handles multi-callback rejection', () => {
		function errCb(cb) {
			setTimeout(() => cb(new Error('problem')), 0);
		}
		async function main(call) {
			await call.multiCb(errCb);
		}
		const funcs = affect({ main });
		return funcs
			.main()
			.then(shouldThrow)
			.catch(isErr('problem'));
	});
});
