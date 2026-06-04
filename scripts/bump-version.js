'use strict';
const fs = require('fs');
const v = require('../package.json').version;
const f = 'app/app.js';
fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace(/const VERSION\s*=\s*'[^']*'/, `const VERSION   = '${v}'`));
console.log(`VERSION → ${v}`);
