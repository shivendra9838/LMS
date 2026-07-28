module.exports = {
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverage: true,
  collectCoverageFrom: [
    'src/utils/loanCalculator.js',
    'src/utils/jwt.js',
    'src/utils/password.js',
    'src/middlewares/auth.middleware.js',
    'src/middlewares/role.middleware.js',
    'src/middlewares/validate.middleware.js',
    'src/validators/**/*.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
