#!/usr/bin/env node

'use strict';

let program = require('commander');

program
  .version(require('../package.json').version)
  .command('info', 'the broker info service')
  .command('mgmt', 'the broker management service')
  .allowUnknownOption(true);

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}
