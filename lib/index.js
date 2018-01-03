const EventEmitter = require('events');
const buildCall = require('./build-call');

function noop() {}
const noopEmitter = {
	emit: noop,
	on: noop
};

const eventNames = ['onCall', 'onCallComplete', 'onFunction', 'onFunctionComplete'];

/**
 * Bind provided event handlers to emitter
 * @param {Object} config
 * @param {Function} config.onFunction
 * @param {Function} config.onFunctionComplete
 * @param {Function} config.onCall
 * @param {Function} config.onCallComplete
 * @returns {(EventEmitter|noopEmitter}
 */
function configureEmitter(config) {
	return eventNames.reduce((e, event) => {
		const handler = config[event];
		let emitter = handler && e === noopEmitter ? new EventEmitter() : e;
		emitter.on(event, handler);
		return emitter;
	}, noopEmitter);
}

/**
 * Affect's buildFunction() interface
 * @param {Object} methods - Affect methods to convert to plain functions
 * @param {Object} config
 * @param {Function} config.onFunction
 * @param {Function} config.onFunctionComplete
 * @param {Function} config.onCall
 * @param {Function} config.onCallComplete
 * @param {Object} config.context
 * @returns {Object} - Methods converted to plain functions (ie: no leading call argument)
 */
function affect(methods, config = {}) {
	const { context = {} } = config;
	const emitter = configureEmitter(config);

	const methodInit = buildCall(affect.Promise, emitter, context);

	return Object.keys(methods).reduce(
		(copy, name) =>
			Object.assign(copy, {
				[name]: methodInit(methods[name])
			}),
		{}
	);
}
affect.Promise = Promise;
affect.configureEmitter = configureEmitter;

module.exports = affect;
