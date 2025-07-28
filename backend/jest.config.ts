import type { Config } from 'jest';
const config: Config = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  globalSetup:    '<rootDir>/tests/jest.globalSetup.ts',
  globalTeardown: '<rootDir>/tests/jest.globalTeardown.ts',
  roots: ['<rootDir>/tests'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
  },
  moduleNameMapper: {
    // adjust these to match your tsconfig.json / webpack aliases:
    '^@models/(.*)$':        '<rootDir>/src/models/$1',
    '^@routes/(.*)$':        '<rootDir>/src/routes/$1',
    '^@utils/(.*)$':         '<rootDir>/src/utils/$1',
    '^@lib/(.*)$':           '<rootDir>/src/lib/$1',
    '^@controllers/(.*)$':   '<rootDir>/src/controllers/$1',
    // add any other top-level aliases you use
  },
  testMatch: ['**/tests/**/*.test.ts'],
  maxWorkers: 1,          // keep serial while stabilising; remove later for parallel
  testTimeout: 30_000
};
export default config; 