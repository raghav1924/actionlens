#!/usr/bin/env node

/**
 * Programmatic JSON output demonstration for ActionLens
 * Maintainer: Jatin Sharma (https://jatinsh.netlify.app/)
 */

import * as api from '../dist/index.js';

console.log('⚡ Inspecting ActionLens programmatic interfaces...');
console.log(Object.keys(api));
console.log('✔ Programmatic inspection completed.');
