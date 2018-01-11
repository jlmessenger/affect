import specAffect from './specs/affect.js';
import specAffectTest from './specs/affect-test.js';
import specFailures from './specs/failures.js';

const specsGeneators = [specAffect, specAffectTest, specFailures];

import affect from '../src/index.mjs';
import affectTest from '../src/test/index.mjs';
import assert from '../src/test/assert.mjs';

const specOpts = {
	affect,
	affectTest,
	assert
};

specsGeneators.forEach(spec => {
	spec(specOpts);
});
