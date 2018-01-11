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

function delay(ms) {
	return output => {
		return new Promise(resolve => {
			setTimeout(resolve, ms, output);
		});
	};
}

module.exports = {
	inner,
	outer,
	callsEach,
	delay
};
