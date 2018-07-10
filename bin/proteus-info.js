#!/usr/bin/env node

'use strict';

let program = require('commander');
let ora = require('ora');

let proteus_js_client = require('proteus-js-client');
let rsocket_tcp_client = require('rsocket-tcp-client');
let rsocket_core = require('rsocket-core');
let rsocket_frame = require('rsocket-core/build/RSocketFrame');

program
  .version(require('../package.json').version)
  .option('-a, --address <host:port>', 'the address of the broker to connect to (required)', process.env.PROTEUS_ADDRESS)
  .option('-k, --key <number>', 'the access key (required)', process.env.PROTEUS_KEY)
  .option('-t, --token <string>', 'the access token (required)', process.env.PROTEUS_TOKEN)
  .option('-b, --broker <string>', 'the broker id')
  .option('-g, --group <string>', 'the group name')
  .option('-d, --destination <string>', 'the destination name');

program.parseOptions(process.argv);

if (!program.address || program.address.indexOf(':') < 0) {
  console.log('\nError: `address` should be in the form of host:port, e.g. 127.0.0.1:6353');
  program.help();
}

if (!program.key) {
  console.log('\nError: `key` is required');
  program.help();
}

if (!program.token) {
  console.log('\nError: `token` is required');
  program.help();
}

const [host, port] = program.address.split(':');
const connection = new rsocket_tcp_client.default({host, port}, rsocket_core.BufferEncoders);

// This Proteus object acts as our gateway to both send messages to services and to register services that we support
const proteus = proteus_js_client.Proteus.create({
  setup: {
    group: 'proteus-cli',
    accessKey: program.key,
    accessToken: program.token,
  },
  transport: {
    connection
  },
});

const rSocket = proteus.group('com.netifi.proteus.admin.brokerServices');
const brokerInfo = new proteus_js_client.BrokerInfoServiceClient(rSocket);

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
  .command('brokers')
  .description('list brokers')
  .action(() => {
    program.promise = new Promise((resolve, reject) => {
      brokerInfo
        .brokers(new proteus_js_client.Empty(), Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
  });

program
  .command('groups')
  .description('list groups')
  .action(() => {
    if (!program.broker) {
      console.log('\nError: `broker` is required');
      program.help();
    }

    const broker = new proteus_js_client.Broker();
    broker.setBrokerid(program.broker);

    program.promise = new Promise((resolve, reject) => {
      brokerInfo
        .groups(broker, Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
  });

program
  .command('destinations')
  .description('list destinations')
  .action(() => {
    if (!program.broker) {
      console.log('\nError: `broker` is required');
      program.help();
    }

    const broker = new proteus_js_client.Broker();
    broker.setBrokerid(program.broker);

    program.promise = new Promise((resolve, reject) => {
      brokerInfo
        .destinations(broker, Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
  });

program
  .command('destinationsByGroup')
  .description('list destinations by group')
  .action(() => {
    if (!program.group) {
      console.log('\nError: `group` is required');
      program.help();
    }

    const group = new proteus_js_client.Group();
    group.setGroup(program.group);

    if (program.broker) {
      const broker = new proteus_js_client.Broker();
      broker.setBrokerid(program.broker);
      group.setBroker(broker);
    }

    program.promise = new Promise((resolve, reject) => {
      brokerInfo
        .destinationsByBrokerAndGroup(group, Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
  });

program
  .command('brokersWithGroup')
  .description('list brokers with group')
  .action(() => {
    if (!program.group) {
      console.log('\nError: `group` is required');
      program.help();
    }

    const group = new proteus_js_client.Group();
    group.setGroup(program.group);

    program.promise = new Promise((resolve, reject) => {
      brokerInfo
        .brokersWithGroup(group, Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
  });

program
  .command('brokerWithDestination')
  .description('list broker with destination')
  .action(() => {
    if (!program.group) {
      console.log('\nError: `group` is required');
      program.help();
    }

    if (!program.destination) {
      console.log('\nError: `destination` is required');
      program.help();
    }

    const destination = new proteus_js_client.Destination();
    destination.setGroup(program.group);
    destination.setDestination(program.destination);

    program.promise = new Promise((resolve, reject) => {

      brokerInfo
        .brokerWithDestination(destination, Buffer.alloc(0))
        .subscribe(singleSubscriber(resolve, reject));
    });
  });

program
  .command('streamGroupEvents')
  .description('streams events pertaining to a group')
  .action(() => {
    if (!program.group) {
      console.log('\nError: `group` is required');
      program.help();
    }

    const group = new proteus_js_client.Group();
    group.setGroup(program.group);

    program.promise = new Promise((resolve, reject) => {
      brokerInfo
        .streamGroupEvents(group, Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
  });

program
  .command('streamDestinationEvents')
  .description('streams events pertaining to a destination')
  .action(() => {
    if (!program.group) {
      console.log('\nError: `group` is required');
      program.help();
    }

    if (!program.destination) {
      console.log('\nError: `destination` is required');
      program.help();
    }

    const destination = new proteus_js_client.Destination();
    destination.setGroup(program.group);
    destination.setDestination(program.destination);

    program.promise = new Promise((resolve, reject) => {
      brokerInfo
        .streamDestinationEvents(destination, Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
  });

program
  .command('streamBrokerEvents')
  .description('streams events pertaining to a broker')
  .action(() => {
    if (!program.broker) {
      console.log('\nError: `broker` is required');
      program.help();
    }

    const broker = new proteus_js_client.Broker();
    broker.setBrokerid(program.broker);

    program.promise = new Promise((resolve, reject) => {
      brokerInfo
        .streamBrokerEvents(broker, Buffer.alloc(0))
        .subscribe(flowableSubscriber(resolve, reject));
    });
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