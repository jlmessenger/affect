import buble from 'rollup-plugin-buble';
// import replace from 'rollup-plugin-replace';

export default [
	{
		input: 'src/index.mjs',
		external: ['events'],
		plugins: [buble()],
		output: [
			{
				name: 'affect',
				format: 'umd',
				interop: false,
				sourcemap: true,
				file: 'dist/affect.js'
			},
			{
				name: 'affect',
				format: 'es',
				file: 'dist/affect.es.js'
			}
		]
	}
];
