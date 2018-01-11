const specAffect = require('./specs/affect.js');
const specAffectTest = require('./specs/affect-test.js');
const specFailures = require('./specs/failures.js');

const specsGeneators = [specAffect, specAffectTest, specFailures];

const affect = require('../index.js');
const affectTest = require('../test.js');
const assert = require('assert');

const specOpts = {
	affect,
	affectTest,
	assert
};

specsGeneators.forEach(spec => {
	spec(specOpts);
});
