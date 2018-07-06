'use strict';

require('colors');
require('events').prototype.inspect = () => {return 'EventEmitter {}';};

let fs = require('fs');
let proteus_js_client = require('proteus-js-client');
let rsocket_tcp_client = require('rsocket-tcp-client');
let rsocket_core = require('rsocket-core');
let rsocket_frame = require('rsocket-core/build/RSocketFrame');
let repl = require('repl');
let _eval = require('eval');
let vm = require('vm');
let url = require('url');

function createClient(args) {
  if (!args.address) {
    throw new Error("Address should be valid");
  }

  const u = new url.URL('http://' + args.address);
  const connection = new rsocket_tcp_client.default(
    {host: u.hostname, port: u.port},
    rsocket_core.BufferEncoders,
  );

  // This Proteus object acts as our gateway to both send messages to services and to register services that we support
  const proteus = proteus_js_client.Proteus.create({
    setup: {
      group: 'proteus-cli',
      accessKey: args.key,
      accessToken: args.token,
    },
    transport: {
      connection
    },
  });

  const group = 'com.netifi.proteus.admin.brokerServices';
  const rs = proteus.group(group);
  const brokerInfo = new proteus_js_client.BrokerInfoServiceClient(rs);
  const brokerManagement = new proteus_js_client.BrokerManagementServiceClient(rs);

  init(group, brokerInfo, brokerManagement, args);
}

function init(group, brokerInfo, brokerManagement, args) {
  let address = args.address;
  let ev = loadEval(args);

  function loadVars(table, displayPrompt, newLine) {
    table.Broker = proteus_js_client.Broker;
    table.Group = proteus_js_client.Group;
    table.Destination = proteus_js_client.Destination;
    table.Event = proteus_js_client.Event;
    table.Empty = proteus_js_client.Empty;
    table.brokerInfo = brokerInfo;
    table.brokerManagement = brokerManagement;
    table.printReply = printReply(displayPrompt, newLine);
    table.pr = table.printReply;
  }

  if (ev && ev.length > 0) {
    let scope = {};
    loadGlobals(scope);
    loadVars(scope, ()=>{}, ()=>{});
    new vm.Script(ev, { displayErrors: true }); // We only use this to get nice compile errors
    _eval(ev, scope);

  } else {
    printUsage(group, address);
    console.log("");

    let replOpts = {
      prompt: getPrompt(group, address),
      ignoreUndefined: true,
      replMode: repl.REPL_MODE_MAGIC,
    };
    let rs = repl.start(replOpts);
    loadVars(rs.context, rs.displayPrompt.bind(rs), console.log);
  }
}

function loadEval(args) {
  if (args.eval) {
    return args.eval;
  } else if (args.exec) {
    return fs.readFileSync(args.exec);
  } else {
    return undefined;
  }
}

function loadGlobals(ctx) {
  for (let prop in global) {
    ctx[prop] = global[prop];
  }
}

function printUsage(group, address) {
  console.log("\nConnecting to %s on %s. Available globals:\n", group, address);

  console.log('  ' + 'brokerInfo'.red + ' - the broker info service');
  printMethod('brokers', 'Empty', 'Flowable<Broker>');
  printMethod('groups', 'Broker', 'Flowable<Group>');
  printMethod('destinations', 'Broker', 'Flowable<Destination>');
  printMethod('destinationsByBrokerAndGroup', 'Group', 'Flowable<Destination>');
  printMethod('destinationsByGroup', 'Group', 'Flowable<Destination>');
  printMethod('brokersWithGroup', 'Group', 'Flowable<Broker>');
  printMethod('brokerWithDestination', 'Destination', 'Single<Broker>');
  printMethod('streamGroupEvents', 'Group', 'Flowable<Event>');
  printMethod('streamDestinationEvents', 'Destination', 'Flowable<Event>');
  printMethod('streamBrokerEvents', 'Empty', 'Flowable<Event>');
  console.log();

  console.log('  ' + 'brokerManagement'.red + ' - the broker management service');
  printMethod('shutdown', 'Empty', 'void');
  printMethod('leave', 'Empty', 'Single<Ack>');
  printMethod('rejoin', 'Empty', 'Single<Ack>');
  printMethod('join', 'Brokers', 'Single<Ack>');
  printMethod('closeDestination', 'Flowable<Destination>', 'Single<Ack>');
  printMethod('closeGroup', 'Group', 'Single<Ack>');
  printMethod('closeBroker', 'Broker', 'Single<Ack>');
  printMethod('closeDestinations', 'Empty', 'Single<Ack>');
  printMethod('closeBrokers', 'Empty', 'Single<Ack>');
  printMethod('closeAll', 'Empty', 'Single<Ack>');
  console.log();

  function printMethod(name, requestType, responseType) {
    console.log('    %s(%s, %s) %s %s', name.green, requestType, "metadata", "returns".gray, responseType);
  }

  function printCmd(cmd, desc, alias) {
    console.log('  ' + cmd.red + ' - ' + desc + ' (alias: ' + alias.red + ')');
  }

  printCmd('printReply', 'function to easily print a unary call reply', 'pr');
}

function getPrompt(group, address) {
  return group.blue + '@' + address + '> ';
}

function printReply(displayPrompt, newLine) {
  return {
    onComplete(value) {
      if (value != null) {
        console.log('onComplete(%o)', value.toObject());
      } else {
        console.log('onComplete()');
      }
      displayPrompt();
    },
    onError(error) {
      console.log('onError(%s)', error.message.red);
      displayPrompt();
    },
    onNext(value) {
      console.log('onNext(%o)', value.toObject());
    },
    onSubscribe(subscription) {
      if (subscription.request != null) {
        subscription.request(rsocket_frame.MAX_REQUEST_N);
      }
    },
  };
}

module.exports = createClient;
