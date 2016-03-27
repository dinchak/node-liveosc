/**
 * @module  node-liveosc
 * @author Tom Dinchak <dinchak@gmail.com>
 */

var chalk = require('chalk');
var OscReceiver = require('osc-receiver');
var OscEmitter = require('osc-emitter');
var Song = require('./lib/song');

/**
 * LiveOSC sets up communication with LiveOSC and holds the song object.
 *
 * Options are as follows:
 *
 * opts.host = host to listen on, default 127.0.0.1
 * opts.port = port to listen on, default 9006
 * opts.liveHost = host live is running on, default 127.0.0.1
 * opts.livePort = port live is listening on, default 9005
 * opts.waitTime = time to wait before sending ready event
 * @constructor
 * @param {Object} opts options
 */
var LiveOSC = function (opts) {
  opts = opts || {};
  this.host = opts.host || '127.0.0.1';
  this.port = opts.port || 9006;
  this.liveHost = opts.liveHost || '127.0.0.1';
  this.livePort = opts.livePort || 9005;
  this.waitTime = opts.waitTime || 1000;
  this.debug = opts.debug || false;

  this.emitter = new OscEmitter();
  this.emitter.add(this.liveHost, this.livePort);
  
  this.receiver = new OscReceiver();
  this.receiver.setMaxListeners(1000);
  this.receiver.bind(this.port);

  if (this.debug) {
    this.receiver.on('message', function () {
      console.log(chalk.magenta('From Live: ') + Array.prototype.slice.call(arguments, 0).join(', '));
    });
    var emit = this.emitter.emit;
    this.emitter.emit = function () {
      var args = Array.prototype.slice.call(arguments, 0).map(function (prm) {
        if (typeof prm.value != 'undefined') {
          return prm.value;
        }
        return prm;
      });
      console.log(chalk.green('  To Live: ') + args.join(', '));
      emit.apply(this, arguments);
    };
  }

  this.song = new Song(this);
};

module.exports = LiveOSC;
