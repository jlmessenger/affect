function call(fn, ...args) {
	return fn(call, ...args);
}
function plain(fn, ...args) {
	return fn(...args);
}
function bound(instance, methodName, ...args) {
	return instance[methodName](...args);
}
function cb(resolve, reject, err, result) {
	if (err) {
		reject(err);
	} else {
		resolve(result);
	}
}
function fromCb(fn, ...args) {
	return new affect.Promise((resolve, reject) => fn(...args.concat(cb.bind(null, resolve, reject))));
}
function mcb(resolve, reject, err, ...results) {
	if (err) {
		reject(err);
	} else {
		resolve(results);
	}
}
function multiCb(fn, ...args) {
	return new affect.Promise((resolve, reject) => fn(...args.concat(mcb.bind(null, resolve, reject))));
}

Object.assign(call, {
	sync: plain,
	plain,
	bound,
	fromCb,
	multiCb
});

function affect(methods) {
	return Object.keys(methods).reduce((out, prop) => {
		const item = methods[prop];
		const type = Array.isArray(item) ? 'array' : typeof item;
		switch (type) {
			case 'function':
				out[prop] = item.bind(null, call);
				break;
			case 'object':
				out[prop] = affect(item);
				break;
			default:
				out[prop] = item;
				break;
		}
		return out;
	}, {});
}
affect.Promise = Promise;
module.exports = affect;
