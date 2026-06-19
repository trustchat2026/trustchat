'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const root = path.join(__dirname, '..');
const required = [
  'package.json',
  'src/main.js',
  'src/preload.js',
  'src/setup.html',
  'assets/icon.png',
  'build/icons/icon.ico',
  'build/icons/icon.icns'
];

let failed = false;
function fail(message) {
  failed = true;
  console.error('ERROR:', message);
}

required.forEach(function (file) {
  if (!fs.existsSync(path.join(root, file))) fail('Missing ' + file);
});

['src/main.js', 'src/preload.js', 'scripts/verify.js'].forEach(function (file) {
  try {
    childProcess.execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    console.log('OK syntax:', file);
  } catch (error) {
    fail('Syntax error in ' + file + '\n' + String(error.stderr || error.message));
  }
});

try {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (pkg.productName !== 'TrustChat Desktop') fail('productName must be TrustChat Desktop');
  if (!pkg.build || !Array.isArray(pkg.build.protocols)) fail('Missing protocol config');
  const protocols = JSON.stringify(pkg.build.protocols || []);
  if (protocols.indexOf('trustchat') === -1) fail('Missing trustchat:// protocol');
  if (!pkg.build.win || !pkg.build.mac) fail('Missing Windows/Mac build targets');
  console.log('OK package config');
} catch (error) {
  fail('Invalid package.json');
}

if (failed) process.exit(1);
console.log('VERIFY CLEAN');
