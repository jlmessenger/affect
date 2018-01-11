let delay;
try {
	setImmediate && (delay = (handler, data) => handler && setImmediate(handler, data));
} catch (e) {
	/* istanbul ignore next */
	delay = (handler, data) => handler && setTimeout(handler, 0, data);
}

function buildEmitter() {
	const handlers = {};
	return {
		on(name, handler) {
			handlers[name] = handler;
		},
		emit(name, data) {
			delay(handlers[name], data);
		}
	};
}

const eventNames = ['onCall', 'onCallComplete', 'onFunction', 'onFunctionComplete'];

/**
 * Bind provided event handlers to emitter
 * @param {Object} config
 * @param {Function} config.onFunction
 * @param {Function} config.onFunctionComplete
 * @param {Function} config.onCall
 * @param {Function} config.onCallComplete
 * @returns {EventEmitter}
 */
export default function configEmitter(config) {
	return eventNames.reduce((emitter, event) => {
		const handler = config[event];
		if (handler) {
			emitter.on(event, handler);
		}
		return emitter;
	}, buildEmitter());
}
