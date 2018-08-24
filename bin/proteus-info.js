#!/usr/bin/env node

'use strict';

let program = require('commander');
let ora = require('ora');

let proteus_js_client = require('proteus-js-client');
let rsocket_frame = require('rsocket-core/build/RSocketFrame');
let empty_pb = require('google-protobuf/google/protobuf/empty_pb');
let ws = require('ws');

program
  .version(require('../package.json').version)
  .option('--address <host:port>', 'the address of the broker to connect to (required)', process.env.PROTEUS_ADDRESS)
  .option('--adminKey <number>', 'the admin key (required)', process.env.PROTEUS_KEY)
  .option('--adminToken <string>', 'the admin token (required)', process.env.PROTEUS_TOKEN)
  .option('-b, --broker <string>', 'the broker id')
  .option('-g, --group <string>', 'the group name')
  .option('-d, --destination <string>', 'the destination name');

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

// This Proteus object acts as our gateway to both send messages to services and to register services that we support
const proteus = proteus_js_client.Proteus.create({
  setup: {
    group: 'proteus-cli',
    accessKey: program.adminKey,
    accessToken: program.adminToken,
  },
  transport: {
    url: 'wss://' + program.address,
    wsCreator: url =>
      new ws(url, {
        rejectUnauthorized: false,
      }),
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
        .brokers(new empty_pb.Empty(), Buffer.alloc(0))
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
    .then(
      () => {
        spinner.succeed();
        proteus.close();
      },
      error => {
        spinner.fail(error.message);
        proteus.close();
      });
}
