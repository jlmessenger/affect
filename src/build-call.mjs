/**
 * Emit post call events
 * @param {string} postEvent
 * @param {EventEmitter} emitter
 * @param {Object} temp - pre call event data
 * @param {boolean} boolean
 * @param result
 * @returns the result is success=true
 * @throws the result if success=false
 */
function postCall(postEvent, emitter, temp, success, result) {
	const end = Date.now();
	const latency = end - temp.start;
	emitter.emit(postEvent, Object.assign(temp, { success, result, end, latency }));
	if (success) {
		return result;
	}
	throw result;
}

/**
 * Emit pre call events
 * @param {Object} methodEvents
 * @param {string} methodEvents.preEvent
 * @param {string} methodEvents.postEvent
 * @param {EventEmitter} emitter
 * @param {Object} context
 * @param {Function} fn
 * @param {Array} args
 * @returns {Function[]} [onFulfill, onReject]
 */
function preCall({ preEvent, postEvent }, emitter, context, fn, args) {
	const start = Date.now();
	emitter.emit(preEvent, { fn, args, context, start });
	const temp = {
		fn,
		args,
		context,
		success: null,
		result: null,
		start,
		end: null,
		latency: null
	};
	return [
		postCall.bind(null, postEvent, emitter, temp, true), // onFulfill
		postCall.bind(null, postEvent, emitter, temp, false) // onReject
	];
}

/**
 * Run a call from an async/promise
 * @param {Object} opts
 * @param {Object} opts.promise - Promise constructor
 * @param {EventEmitter} opts.emitter
 * @param {Object} opts.call
 * @param {Object} opts.context
 * @param {Object} methodEvents
 * @param {string} methodEvents.preEvent
 * @param {string} methodEvents.postEvent
 * @param {Array} argsToLog - arguments included in emitter
 * @param {Function} fn
 * @param {Array} args - arguments to apply to function
 * @returns {Promise}
 */
function runPromise({ promise, emitter, call, context }, methodEvents, argsToLog, fn, args) {
	const [onFulfill, onReject] = preCall(methodEvents, emitter, context, fn, argsToLog);
	return promise
		.resolve(args)
		.then(a => fn(...a))
		.then(onFulfill, onReject);
}

/**
 * Run a call from a callback
 * @param {Object} opts
 * @param {Object} opts.promise - Promise constructor
 * @param {EventEmitter} opts.emitter
 * @param {Object} opts.context
 * @param {boolean} multiArgs - true for cb(err, first, second) resolves [first, second], false resolves first
 * @param {Array} argsToLog - arguments included in emitter
 * @param {Function} fn
 * @param {Array} args - arguments to apply to function
 * @returns {Promise}
 */
function runCallback({ promise, emitter, context }, multiArgs, fn, args) {
	const [onFulfill, onReject] = preCall(callEvents, emitter, context, fn, args);
	return new promise((resolve, reject) => {
		fn(...args, (err, ...data) => {
			if (err) {
				reject(err);
			}
			resolve(multiArgs ? data : data[0]);
		});
	}).then(onFulfill, onReject);
}

const callEvents = {
	preEvent: 'onCall',
	postEvent: 'onCallComplete'
};
const methodEvents = {
	preEvent: 'onFunction',
	postEvent: 'onFunctionComplete'
};

/**
 * Run method as a normal function
 * @param {Object} opts
 * @param {Function} fn
 * @param {Array} args
 * @returns {Promise}
 */
function methodRunner(opts, fn, ...args) {
	return runPromise(opts, methodEvents, args, fn, [opts.call, ...args]);
}

// Runners for each call.<method>() interface
export const callRunners = {
	call(opts, fn, ...args) {
		return runPromise(opts, callEvents, args, fn, [opts.call, ...args]);
	},
	plain(opts, fn, ...args) {
		return runPromise(opts, callEvents, args, fn, args);
	},
	sync({ emitter, context }, fn, ...args) {
		const [onFulfill, onReject] = preCall(callEvents, emitter, context, fn, args);
		try {
			const result = fn(...args);
			return onFulfill(result);
		} catch (ex) {
			return onReject(ex);
		}
	},
	fromCb(opts, fn, ...args) {
		return runCallback(opts, false, fn, args);
	},
	multiCb(opts, fn, ...args) {
		return runCallback(opts, true, fn, args);
	}
};

/**
 * Create call interface from runners
 * @param {Object} runners
 * @param {Function} runners.call
 * @param {Function} runners.plain
 * @param {Function} runners.sync
 * @param {Function} runners.fromCb
 * @param {Function} runners.multiCb
 * @param {Function} runners.context
 * @param {Object} opts
 * @param {Object} promise - Promise constructor
 * @param {EventEmitter} emitter
 * @param {Object} context
 * @returns {Object}
 */
function createCallInterface(runners, opts) {
	const call = (opts.call = runners.call.bind(null, opts));
	call.plain = runners.plain.bind(null, opts);
	call.sync = runners.sync.bind(null, opts);
	call.fromCb = runners.fromCb.bind(null, opts);
	call.multiCb = runners.multiCb.bind(null, opts);
	call.context = opts.context;
	return call;
}

/**
 * Combine group and local context into localOpts object
 * @param {Object} opts
 * @param {Object} opts.context
 * @param {Object} methodContext
 * @returns {Object} localOpts
 */
function buildLocalOpts(opts, methodContext) {
	const context = Object.assign({}, opts.context, methodContext);
	return Object.assign({}, opts, { context });
}

/**
 * Create call interface with provided runners
 * @param {Object} promise - Promise constructor
 * @param {EventEmitter} emitter
 * @param {Object} context
 * @param {Object} [runners]
 * @returns {Function} methodInit(fn)
 */
export function buildCall(promise, emitter, context, runners) {
	const opts = { promise, emitter, context, call: null };

	const call = createCallInterface(runners, opts);

	const methodInit = fn => {
		const bound = methodRunner.bind(null, opts, fn);
		bound.withContext = (context, ...args) => {
			const localOpts = buildLocalOpts(opts, context);
			const call = createCallInterface(runners, localOpts);
			return methodRunner(localOpts, fn, ...args);
		};
		return bound;
	};

	return methodInit;
}
