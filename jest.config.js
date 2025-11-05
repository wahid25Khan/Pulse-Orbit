const { jestConfig } = require("@salesforce/sfdx-lwc-jest/config");

module.exports = {
	...jestConfig,
	moduleNameMapper: {
		"^lightning/platformShowToastEvent$":
			"<rootDir>/force-app/test/jest-mocks/lightning/platformShowToastEvent",
		"^@salesforce/apex$": "<rootDir>/force-app/test/jest-mocks/apex",
		"^@salesforce/schema$": "<rootDir>/force-app/test/jest-mocks/schema",
		"^lightning/uiRecordApi$":
			"<rootDir>/force-app/test/jest-mocks/lightning/uiRecordApi",
		"^c/(.+)$": "<rootDir>/force-app/main/default/lwc/$1/$1",
	},
	testPathIgnorePatterns: [
		"/node_modules/",
		"/force-app/main/default/lwc/__tests__/util.js",
	],
	coveragePathIgnorePatterns: [
		"/node_modules/",
		"/force-app/test/",
		"/force-app/main/default/lwc/__tests__/",
	],
	collectCoverageFrom: [
		"force-app/main/default/lwc/**/*.js",
		"!force-app/main/default/lwc/__tests__/**",
	],
	coverageThreshold: {
		global: {
			branches: 80,
			functions: 80,
			lines: 80,
			statements: 80,
		},
	},
};
