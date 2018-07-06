#!/usr/bin/env node

'use strict';

let program = require('commander');

let cli = require('../lib');

program
  .version(require('../package.json').version)
  .option('-a, --address <host:port>', 'the address of the broker to connect to (required)')
  .option('-k, --key <number>', 'the access key (required)')
  .option('-t, --token <string>', 'the access token (required)')
  .option('-e, --eval <string>', 'evaluate script and print result (optional)')
  .option('-x, --exec <path>', 'execute a script file and print the results (optional)')
  .parse(process.argv);

if (!program.address || program.address.indexOf(':') < 0) {
  console.log('\nError: `address` should be in the form of host:port, e.g. 127.0.0.1:6353');
  program.help();
}

try {
  cli(program);
} catch (e) {
  console.error(e);
  process.exit(1);
}
