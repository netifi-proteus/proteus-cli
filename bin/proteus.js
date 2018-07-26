#!/usr/bin/env node

'use strict';

let program = require('commander');

program
  .version(require('../package.json').version)
  .command('info', 'the broker info service')
  .command('access', 'the broker access key service')
  .allowUnknownOption(true);

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

if (!program._execs[program.args[0]]) {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
  process.exit(1);
}
