/**
 * @module node-liveosc
 * @author Tom Dinchak <dinchak@gmail.com>
 */

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;

/**
 * Device object, represents a device in the Ableton Live set.
 * @constructor
 * @param {Object} liveosc LiveOSC instance
 * @param {Number} id      id of the device
 * @param {Object} track   track the device belongs to
 * @param {String} type    type of device's track ('track', 'return', 'master')
 * @param {String} name    name of the device
 */
var Device = function (liveosc, id, track, type, name) {

  /**
   * Instance of LiveOSC
   * @type {Object}
   */
  this.liveosc = liveosc;

  /**
   * The name of this device
   * @type {String}
   */
  this.name = name;

  /**
   * The id of this device
   * @type {Number}
   */
  this.id = id;

  /**
   * The track this device belongs to
   * @type {Object}
   */
  this.track = track;

  /**
   * The type of track the device is on, valid types are:
   * 
   *   master
   *   track
   *   return
   *   
   * @type {String}
   */
  this.type = type;

  /**
   * The parameter values of a device, format of a parameter is:
   *
   *   {
   *     id: 0,
   *     value: 1,
   *     name: 'Device On',
   *     min: 0,
   *     max: 1
   *   }
   * 
   * @type {Array}
   */
  this.params = [];

  /**
   * EventEmitter for device events
   * @type {EventEmitter}
   */
  this.eventEmitter = new EventEmitter();

  var self = this;

  // determine listener addresses based on track type
  var infoAddr = '/live/device';
  var rangeAddr = '/live/device/range';
  var paramAddr = '/live/device/param';
  var allParamAddr = '/live/device/allparam';
  if (type != 'track') {
    infoAddr = '/live/' + type + '/device';
    rangeAddr = '/live/' + type + '/device/range';
    paramAddr = '/live/' + type + '/device/param';
    allParamAddr = '/live/' + type + '/device/allparam';
    if (type == 'master') {
      allParamAddr = '/live/master/device';
    }
  }

  /**
   * Listen for /live/device/range
   */
  function rangeListener() {
    var args = Array.prototype.slice.call(arguments, 0);
    if (type != 'master') {
      var trackId = args.shift();
      if (trackId != self.track.id) return;
    }
    var deviceId = args.shift();
    if (deviceId != self.id) return;
    for (var i = 0; i < args.length; i += 3) {
      if (!self.params[args[i]]) {
        self.params[args[i]] = {};
      }
      var param = self.params[args[i]];
      param.min = args[i + 1];
      param.max = args[i + 2];
    }
  }

  /**
   * Listen for /live/device/allparam
   */
  function allParamListener() {
    var args = Array.prototype.slice.call(arguments, 0);
    if (type != 'master') {
      var trackId = args.shift();
      if (trackId != self.track.id) return;
    }
    var deviceId = args.shift();
    if (deviceId != self.id) return;
    for (var i = 0; i < args.length; i += 3) {
      if (!self.params[args[i]]) {
        self.params[args[i]] = {};
      }
      var param = self.params[args[i]];
      if (param.value != args[i + 1]) {
        self.emitEvent('param', {
          name: args[i + 2],
          value: args[i + 1],
          prev: param.value
        });
        self.emitEvent(args[i + 2], {
          value: args[i + 1],
          prev: param.value
        });
      }
      param.id = args[i];
      param.value = args[i + 1];
      param.name = args[i + 2];
    }
  }

  /**
   * Listen for /live/device/param
   */
  function paramListener() {
    var args = Array.prototype.slice.call(arguments, 0);
    if (type != 'master') {
      var trackId = args.shift();
      if (trackId != self.track.id) return;
    }
    var deviceId = args.shift();
    if (deviceId != self.id) return;
    if (!self.params[args[0]]) {
      self.params[args[0]] = {};
    }
    var param = self.params[args[0]];
    self.emitEvent('param', {
      name: args[2],
      value: args[1],
      prev: param.value
    });
    self.emitEvent(args[2], {
      value: args[1],
      prev: param.value
    });
    param.id = args[0];
    param.value = args[1];
    param.name = args[2];
  }

  liveosc.receiver.on(rangeAddr, rangeListener);
  liveosc.receiver.on(allParamAddr, allParamListener);
  liveosc.receiver.on(paramAddr, paramListener);

  var args = [infoAddr];
  if (type != 'master') {
    args.push({type: 'integer', value: track.id});
  }
  args.push({type: 'integer', value: id});
  liveosc.emitter.emit.apply(liveosc.emitter, args);

  var args = [rangeAddr];
  if (type != 'master') {
    args.push({type: 'integer', value: track.id});
  }
  args.push({type: 'integer', value: id});
  liveosc.emitter.emit.apply(liveosc.emitter, args);

  /**
   * Called when a device is refreshed or destroyed
   */
  this.destroy = function () {
    self.emitEvent('destroy');
    self.eventEmitter.removeAllListeners();
    self.liveosc.receiver.removeListener(rangeAddr, rangeListener);
    self.liveosc.receiver.removeListener(paramAddr, paramListener);
    self.liveosc.receiver.removeListener(allParamAddr, allParamListener);
  };
};

/**
 * Set a device parameter to a value
 * @param {Mixed}  param id of the parameter or name of the parameter
 * @param {Number} value new parameter value
 */
Device.prototype.set = function (param, value) {
  var addr;
  if (this.type == 'track') {
    addr = '/live/device';
  } else {
    addr = '/live/' + this.type + '/device';
  }
  var args = [addr];
  if (this.type != 'master') {
    args.push({type: 'integer', value: this.track.id});
  }
  args.push({type: 'integer', value: this.id});
  if (typeof param == 'string') {
    var prm = _.findWhere(this.params, {name: param});
    if (prm) {
      param = prm.id;
    } else {
      throw new Error('No parameter with name ' + param);
    }
  }
  args.push({type: 'integer', value: param});
  args.push({type: 'integer', value: value});
  this.liveosc.emitter.emit.apply(
    this.liveosc.emitter,
    args
  );
};

/**
 * Focus this device
 */
Device.prototype.view = function () {
  var args = ['/live/' + this.type + '/device/view'];
  if (this.type != 'master') {
    args.push({type: 'integer', value: this.id});
  }
  args.push({type: 'integer', value: this.id});
  this.liveosc.emitter.emit.apply(
    this.liveosc.emitter,
    args
  );
};

/**
 * Listen for a device event, current events are:
 *
 *   param
 *     * fired on any parameter change
 *   <name of the parameter>
 *     * listen for a specific parameter
 *   destroy
 *   
 * @param  {String}   ev event name
 * @param  {Function} cb callback
 */
Device.prototype.on = function (ev, cb) {
  this.eventEmitter.on(ev, cb);
};

/**
 * Emit a device event
 * @param  {String} ev     event name
 * @param  {Object} params event parameters
 */
Device.prototype.emitEvent = function (ev, params) {
  this.eventEmitter.emit(ev, params);
  var globalParams = _.extend({id: this.id, type: this.type}, params);
  if (this.type != 'master') {
    globalParams.trackId = this.track.id;
  }
  this.liveosc.song.eventEmitter.emit('device:' + ev, globalParams);
};

module.exports = Device;
