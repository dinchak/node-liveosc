/**
 * @module node-liveosc
 * @author Tom Dinchak <dinchak@gmail.com>
 */

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var Device = require('./device');

/**
 * Return object, represents a return track in the Ableton Live set.
 * @constructor
 * @param {Object} liveosc LiveOSC instance
 * @param {Number} id      id of the return
 */
var Return = function (liveosc, id) {

  /**
   * Instance of LiveOSC
   * @type {Object}
   */
  this.liveosc = liveosc;

  /**
   * Name of the return
   * @type {String}
   */
  this.name = '';

  /**
   * The id of this return
   * @type {Number}
   */
  this.id = id;

  /**
   * Return soloed
   * @type {Number}
   */
  this.solo = 0;

  /**
   * Return muted
   * @type {Number}
   */
  this.mute = 0;

  /**
   * Return volume
   * @type {Number}
   */
  this.volume = 0;

  /**
   * Return panning
   * @type {Number}
   */
  this.pan = 0;

  /**
   * Devices in this return
   * @type {Array}
   */
  this.devices = [];

  /**
   * Return send levels
   * ex [{id: 0, value: 1.0}]
   * @type {Array}
   */
  this.sends = [];

  /**
   * EventEmitter for return events
   * @type {EventEmitter}
   */
  this.eventEmitter = new EventEmitter();

  var self = this;

  /**
   * Listen for /live/return/send
   */
  function sendListener() {
    var trackId = arguments[0];
    if (trackId != id) {
      return;
    }
    for (var i = 1; i < Object.keys(arguments).length; i += 2) {
      var sendNum = arguments[i];
      var sendVal = arguments[i+1];
      self.emitEvent('send', {
        num: sendNum,
        value: sendVal,
        prev: self.sends[sendNum]
      });
      self.sends[sendNum] = sendVal;
    }
  }

  /**
   * Listen for /live/return/solo
   * @param  {Number} trackId the id of the return
   * @param  {Number} solo    0 or 1
   */
  function soloListener(trackId, solo) {
    if (trackId != self.id) return;
    self.emitEvent('solo', {
      value: solo,
      prev: self.solo
    });
    self.solo = solo;
  }

  /**
   * Listen for /live/return/mute
   * @param  {Number} trackId the id of the return
   * @param  {Number} mute    0 or 1
   */
  function muteListener(trackId, mute) {
    if (trackId != self.id) return;
    self.emitEvent('mute', {
      value: mute,
      prev: self.mute
    });
    self.mute = mute;
  }

  /**
   * Listen for /live/return/volume
   * @param  {Number} trackId the id of the return
   * @param  {Number} volume  new return volume
   */
  function volumeListener(trackId, volume) {
    if (trackId != self.id) return;
    self.volume = volume;
    self.emitEvent('volume', {
      value: volume,
      prev: self.volume
    });
  }

  /**
   * Listen for /live/return/pan
   * @param  {Number} trackId the id of the return
   * @param  {Number} pan     new return panning
   */
  function panListener(trackId, pan) {
    if (trackId != self.id) return;
    self.pan = pan;
    self.emitEvent('pan', {
      value: pan,
      prev: self.pan
    });
  }

  /**
   * Listen for /live/return/info
   * @param  {Number} trackId the id of the return
   * @param  {Number} solo    0 or 1
   * @param  {Number} mute    0 or 1
   * @param  {Number} volume  current return volume
   * @param  {Number} pan     current return panning
   */
  function infoListener(trackId, solo, mute, volume, pan) {
    if (trackId != self.id) return;
    self.solo = solo;
    self.mute = mute;
    this.volume = volume;
    this.pan = pan;
    self.emitEvent('solo', {
      value: solo,
      prev: self.solo
    });
    self.emitEvent('mute', {
      value: mute,
      prev: self.mute
    });
    self.emitEvent('volume', {
      value: volume,
      prev: self.volume
    });
    self.emitEvent('pan', {
      value: pan,
      prev: self.pan
    });
  }

  /**
   * Listen for /live/return/devicelist
   */
  function devicelistListener() {
    var args = Array.prototype.slice.call(arguments, 0);
    var trackId = args.shift();
    if (trackId != self.id) return;
    for (var i = 0; i < args.length; i += 2) {
      var deviceId = args[i];
      var deviceName = args[i + 1];
      self.devices.push(new Device(liveosc, deviceId, self, 'return', deviceName));
    }
  }

  /**
   * Listen for /live/name/return
   * This is called when devices are added or removed
   * @param  {Number} trackId the id of the return
   * @param  {String} name    the name of the return
   */
  function nameListener(trackId, name) {
    if (trackId != self.id) return;
    self.emitEvent('name', {
      value: name,
      prev: self.name
    });
    self.name = name;
    liveosc.emitter.emit('/live/scenes');
    _.each(self.devices, function (device) {
      device.destroy();
    });
    self.devices = [];
    liveosc.emitter.emit('/live/return/info', {type: 'integer', value: id});
    liveosc.emitter.emit('/live/return/devicelist', {type: 'integer', value: id});

  }

  liveosc.receiver.on('/live/return/send', sendListener);
  liveosc.receiver.on('/live/return/solo', soloListener);
  liveosc.receiver.on('/live/return/mute', muteListener);
  liveosc.receiver.on('/live/return/volume', volumeListener);
  liveosc.receiver.on('/live/return/pan', panListener);
  liveosc.receiver.on('/live/return/info', infoListener);
  liveosc.receiver.on('/live/return/devicelist', devicelistListener);
  liveosc.receiver.on('/live/name/return', nameListener);

  /**
   * Called when a return is refreshed or destroyed
   */
  this.destroy = function () {
    this.eventEmitter.emit('destroy');
    this.eventEmitter.removeAllListeners();
    this.liveosc.receiver.removeListener('/live/return/send', sendListener);
    this.liveosc.receiver.removeListener('/live/return/solo', soloListener);
    this.liveosc.receiver.removeListener('/live/return/mute', muteListener);
    this.liveosc.receiver.removeListener('/live/return/volume', volumeListener);
    this.liveosc.receiver.removeListener('/live/return/pan', panListener);
    this.liveosc.receiver.removeListener('/live/return/info', infoListener);
    this.liveosc.receiver.removeListener('/live/return/devlicelist', devicelistListener);
    this.liveosc.receiver.removeListener('/live/name/return', nameListener);

    _.each(this.devices, function (device) {
      device.destroy();
    });
    this.devices = [];
  };

  liveosc.emitter.emit('/live/return/send', {type: 'integer', value: id});
  liveosc.emitter.emit('/live/name/return', {type: 'integer', value: id});
};

/**
 * Set the name of the return
 * @param {String} name the new track name
 */
Return.prototype.setName = function (name) {
  this.liveosc.emitter.emit(
    '/live/name/return',
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'string',
      value: name
    }
  );
};


/**
 * Set the return solo state
 * @param {Number} solo 0 or 1
 */
Return.prototype.setSolo = function (solo) {
  this.liveosc.emitter.emit(
    '/live/return/solo',
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: solo
    }
  );
};

/**
 * Set the return mute state
 * @param {Number} mute 0 or 1
 */
Return.prototype.setMute = function (mute) {
  this.liveosc.emitter.emit(
    '/live/return/mute',
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: mute
    }
  );
};

/**
 * Set the return volume
 * @param {Number} volume 0.0 - 1.0
 */
Return.prototype.setVolume = function (volume) {
  this.liveosc.emitter.emit(
    '/live/return/volume',
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'float',
      value: volume
    }
  );
};

/**
 * Set the return panning
 * @param {Number} pan -1.0 - 1.0
 */
Return.prototype.setPan = function (pan) {
  this.liveosc.emitter.emit(
    '/live/return/pan',
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'float',
      value: pan
    }
  );
};

/**
 * Set return send level
 * @param {Number} send send id
 * @param {Number} val  new send level (0.0 - 1.0)
 */
Return.prototype.setSend = function (send, val) {
  this.liveosc.emitter.emit(
    '/live/return/send',
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: send
    },
    {
      type: 'float',
      value: val
    }
  );
};

/**
 * Focus the return
 */
Return.prototype.view = function () {
  this.liveosc.emitter.emit(
    '/live/return/view',
    {
      type: 'integer',
      value: this.id
    }
  );
};

/**
 * Listen for a return event, current events are:
 *
 *   send
 *   solo
 *   mute
 *   volume
 *   pan
 *   name
 *   destroy
 * 
 * @param  {String}   ev event name
 * @param  {Function} cb callback
 */
Return.prototype.on = function (ev, cb) {
  this.eventEmitter.on(ev, cb);
};

/**
 * Emit a return event
 * @param  {String} ev     event name
 * @param  {Object} params event parameters
 */
Return.prototype.emitEvent = function (ev, params) {
  this.eventEmitter.emit(ev, params);
  this.liveosc.song.eventEmitter.emit(
    'return:' + ev,
    _.extend({id: this.id}, params)
  );
};

module.exports = Return;
