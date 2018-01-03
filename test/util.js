function inner(_, x) {
	return `(inner ${x})`;
}
async function outer(call, x) {
	try {
		const y = await call(inner, x);
		const z = await call(inner, y);
		return `outer: ${z}`;
	} catch (ex) {
		ex.message = `rethrow ${ex.message}`;
		throw ex;
	}
}

function callsEach(call) {
	return call(inner, '_').then(() => Promise.all(['static', call(inner, 'a'), call(inner, 'b')]));
}

module.exports = {
	inner,
	outer,
	callsEach
};
