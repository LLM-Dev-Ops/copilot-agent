module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  // The service's own tsconfig sets rootDir: ./src, which excludes tests/.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { esModuleInterop: true, strict: true, target: 'ES2022' } }],
  },
  testTimeout: 30000,
};
