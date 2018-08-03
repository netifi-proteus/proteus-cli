#!/usr/bin/env node

'use strict';

let program = require('commander');
let ora = require('ora');

let proteus_js_client = require('proteus-js-client');
let rsocket_tcp_client = require('rsocket-tcp-client');
let rsocket_core = require('rsocket-core');
let rsocket_frame = require('rsocket-core/build/RSocketFrame');
let empty_pb = require('google-protobuf/google/protobuf/empty_pb');
let crypto = require('crypto');

program
  .version(require('../package.json').version)
  .option('--address <host:port>', 'the address of the broker to connect to (required)', process.env.PROTEUS_ADDRESS)
  .option('--adminKey <number>', 'the admin key (required)', process.env.PROTEUS_KEY)
  .option('--adminToken <string>', 'the admin token (required)', process.env.PROTEUS_TOKEN)
  .option('-k, --key <number>', 'the access key')
  .option('-d, --description <string>', 'the access key description');

program.parseOptions(process.argv);

if (!program.address || program.address.indexOf(':') < 0) {
  console.log('\nError: `address` should be in the form of host:port, e.g. 127.0.0.1:6353');
  program.help();
}

if (!program.adminKey) {
  console.log('\nError: `adminKey` is required');
  program.help();
}

if (!program.adminToken) {
  console.log('\nError: `adminToken` is required');
  program.help();
}

const [host, port] = program.address.split(':');
const connection = new rsocket_tcp_client.default({host, port}, rsocket_core.BufferEncoders);

// This Proteus object acts as our gateway to both send messages to services and to register services that we support
const proteus = proteus_js_client.Proteus.create({
  setup: {
    group: 'proteus-cli',
    accessKey: program.adminKey,
    accessToken: program.adminToken,
  },
  transport: {
    connection
  },
});

const rSocket = proteus.group('com.netifi.proteus.admin.brokerServices');
const accessKeyInfo = new proteus_js_client.AccessKeyInfoServiceClient(rSocket);

const spinner = ora();
const flowableSubscriber = (resolve, reject) => ({
  onNext(value) {
    spinner.clear();
    spinner.frame();
    console.log(value.toObject());
  },
  onComplete() {
    resolve();
  },
  onError(error) {
    reject(error);
  },
  onSubscribe(subscription) {
    subscription.request(rsocket_frame.MAX_REQUEST_N);
  }
});
const singleSubscriber = (resolve, reject) => ({
  onComplete(value) {
    spinner.clear();
    spinner.frame();
    console.log(value.toObject());
    resolve();
  },
  onError(error) {
    reject(error);
  }
});

program
  .command('generate')
  .description('generate access key')
  .action(() => {
    program.promise = new Promise((resolve, reject) => {
      try {
        const buffer = crypto.randomBytes(8);
        const low = buffer.readUInt32LE(0);
        const high = buffer.readUInt32LE(4);

        const token = new proteus_js_client.AccessToken();
        token.setKey(((high >>> 11) * 0x100000000) + low);
        token.setAccesstoken(crypto.randomBytes(20));
        token.setDescription('Generated by Proteus CLI ' + program._version);

        console.log(token.toObject());
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  });

program
  .command('create')
  .description('create access key')
  .action(() => {
    program.promise = new Promise((resolve, reject) => {
      const params = new proteus_js_client.AccessKeyParameters();
      params.setDescription(program.description);

      accessKeyInfo
        .createAccessKey(token, Buffer.alloc(0))
        .subscribe(singleSubscriber(resolve, reject));
    });
  });

program
  .command('remove')
  .description('remove access key')
  .action(() => {
    program.promise = new Promise((resolve, reject) => {
      if (!program.key) {
        console.log('\nError: `key` is required');
        program.help();
      }

      const key = new proteus_js_client.AccessKey();
      key.setKey(program.key);

      accessKeyInfo
        .removeAccessKey(key, Buffer.alloc(0))
        .subscribe(singleSubscriber(resolve, reject));
    });
  });

program
  .command('disable')
  .description('disable access key')
  .action(() => {
    program.promise = new Promise((resolve, reject) => {
      if (!program.key) {
        console.log('\nError: `key` is required');
        program.help();
      }

      const key = new proteus_js_client.AccessKey();
      key.setKey(program.key);

      accessKeyInfo
        .disableAccessKey(key, Buffer.alloc(0))
        .subscribe(singleSubscriber(resolve, reject));
    });
  });

program
  .command('enable')
  .description('enable access key')
  .action(() => {
    program.promise = new Promise((resolve, reject) => {
      if (!program.key) {
        console.log('\nError: `key` is required');
        program.help();
      }

      const key = new proteus_js_client.AccessKey();
      key.setKey(program.key);

      accessKeyInfo
        .enableAccessKey(key, Buffer.alloc(0))
        .subscribe(singleSubscriber(resolve, reject));
    });
  });

program
  .command('key')
  .description('retrieve access key')
  .action(() => {
    program.promise = new Promise((resolve, reject) => {
      if (!program.key) {
        console.log('\nError: `key` is required');
        program.help();
      }

      const key = new proteus_js_client.AccessKey();
      key.setKey(program.key);

      accessKeyInfo
        .getAccessKey(key, Buffer.alloc(0))
        .subscribe(singleSubscriber(resolve, reject));
    });
  });

program
  .command('keys')
  .description('list access keys')
  .action(() => {
    program.promise = new Promise((resolve, reject) => {
      accessKeyInfo
        .getAccessKeys(new empty_pb.Empty(), Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
  });

program.on('command:*', command => {
  console.error('Invalid command: %s\nSee --help for a list of available commands.', command);
  process.exit(1);
});

program.parse(process.argv);

if (!program.args.length) {
  program.help();
}

if (program.promise) {
  spinner.start();
  program.promise
    .then(() => spinner.succeed(), error => spinner.fail(error.message))
    .finally(() => proteus.close());
}
