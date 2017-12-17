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

module.exports = {
	inner,
	outer
};
