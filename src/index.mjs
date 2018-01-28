import { callRunners, buildCall } from './build-call.mjs';
import configEmitter from './config-emitter.mjs';

const _internal = { buildCall, configEmitter, callRunners };

function buildFunctions(methods, methodInit) {
	return Object.keys(methods).reduce((copy, name) => {
		const item = methods[name];
		const type = Array.isArray(item) ? 'array' : typeof item;
		switch (type) {
			case 'function':
				copy[name] = methodInit(methods[name]);
				break;
			case 'object':
				copy[name] = buildFunctions(item, methodInit);
				break;
			default:
				copy[name] = item;
		}
		return copy;
	}, {});
}

/**
 * Affect's build function interface
 * @param {Object} methods - Affect methods to convert to plain functions
 * @param {Object} config
 * @param {Function} config.onFunction
 * @param {Function} config.onFunctionComplete
 * @param {Function} config.onCall
 * @param {Function} config.onCallComplete
 * @param {Object} config.context
 * @returns {Object} - Methods converted to plain functions (ie: no leading call argument)
 */
export default function affect(methods, config = {}) {
	const { context = {} } = config;
	const emitter = configEmitter(config);

	const methodInit = buildCall(affect.Promise, emitter, context, callRunners);

	return buildFunctions(methods, methodInit);
}
Object.assign(affect, { Promise, _internal });
