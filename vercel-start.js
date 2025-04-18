// vercel-start.js
// This script ensures tsconfig-paths is registered before starting the main application.

// Ensure NODE_ENV is set, Vercel usually sets this. Default if not.
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

console.log('Registering tsconfig-paths...');
// Register tsconfig-paths
require('tsconfig-paths/register');
console.log('tsconfig-paths registered.');

console.log('Starting application from ./dist/index.js...');
// Now require the actual compiled entry point
require('./dist/index.js');
console.log('Application required.'); // This might not be reached if the app starts listening immediately
