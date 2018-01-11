import buble from 'rollup-plugin-buble';
import replace from 'rollup-plugin-replace';

export default [
	{
		input: 'src/test/index.mjs',
		external: ['affect', 'assert'],
		plugins: [
			replace({
				values: {
					'../index.mjs': " from 'affect';"
				},
				delimiters: [" from '", "';"]
			}),
			buble()
		],
		output: [
			{
				name: 'affect.test',
				format: 'umd',
				interop: false,
				globals: {
					affect: 'affect',
					assert: 'assert'
				},
				sourcemap: true,
				paths: {
					affect: './affect.js'
				},
				file: 'dist/affect-test.js'
			},
			{
				name: 'affect-test',
				format: 'es',
				file: 'dist/affect-test.es.js'
			}
		]
	}
];
