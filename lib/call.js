function postCall(emitter, temp, success, result) {
	const end = Date.now();
	emitter.emit('onCallComplete', Object.assign(temp, {
		success,
		result,
		end,
		latency: end - temp.start
	}));
	if (success) {
		return result;
	}
	throw result;
}

function preCall(emitter, fn, args) {
	const start = Date.now();
	emitter.emit('onCall', { fn, args, start });
	const temp = { fn, args, success: null, result: null, start, end: null, latency: null };
	return [
		postCall.bind(null, emitter, temp, true), // onFulfill
		postCall.bind(null, emitter, temp, false) // onReject
	];
}

function runner({ promise, emitter, caller }, isPlain, fn, ...args) {
	const postArgs = preCall(emitter, fn, args);
	const r = isPlain ? args : [caller, ...args];
	return promise.resolve(r)
		.then(a => fn(...a))
		.then(...postArgs);
}

function buildCaller(promise, emitter, intercept = false) {
	// ensure intercept provides same interface as normal call
	if (intercept) {
		intercept.plain = intercept;
	}
	const opts = { promise, emitter, caller: null };

	const call = runner.bind(null, opts, false);
	call.plain = runner.bind(null, opts, true);

	// ensure runner uses intercept if provided
	opts.caller = intercept || call;

	return call;
}

module.exports = buildCaller;
