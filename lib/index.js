const EventEmitter = require('events');
const buildCaller = require('./call');

const noopEmitter = {
	emit() {}
};

function affect(methods, config = {}) {
	const { onCall, onCallComplete } = config;
	const emitter = (!onCall && !onCallComplete) ? noopEmitter : new EventEmitter();
	if (onCall) {
		emitter.on('onCall', onCall);
	}
	if (onCallComplete) {
		emitter.on('onCallComplete', onCallComplete);
	}

	const theCaller = buildCaller(affect.Promise, emitter);

	return Object.keys(methods).reduce((copy, name) => Object.assign(copy, {
		[name]: theCaller.bind(null, methods[name])
	}), {});
}
affect.Promise = Promise;

module.exports = affect;
