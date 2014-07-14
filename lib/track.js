/**
 * @module node-liveosc
 * @author Tom Dinchak <dinchak@gmail.com>
 */

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;

var Clip = require('./clip');
var Device = require('./device');

/**
 * Track object, represents an audio or midi track in the Ableton Live set.
 * @constructor
 * @param {Object} liveosc LiveOSC instance
 * @param {Number} id      id of the track
 */
var Track = function (liveosc, id) {

  /**
   * Instance of LiveOSC
   * @type {Object}
   */
  this.liveosc = liveosc;

  /**
   * The id of this track
   * @type {Number}
   */
  this.id = id;

  /**
   * The name of this track
   * @type {String}
   */
  this.name = '';

  /**
   * Clips in this track
   * @type {Array}
   */
  this.clips = [];

  /**
   * Track send levels
   * ex [{id: 0, value: 1.0}]
   * @type {Array}
   */
  this.sends = [];

  /**
   * Devices in this track
   * @type {Array}
   */
  this.devices = [];

  /**
   * 0 = MIDI track, 1 = Audio track
   * @type {Number}
   */
  this.audio = 0;

  /**
   * Track soloed
   * @type {Number}
   */
  this.solo = 0;

  /**
   * Track muted
   * @type {Number}
   */
  this.mute = 0;

  /**
   * Track armed (audio only)
   * @type {Number}
   */
  this.arm = 0;

  /**
   * Track volume
   * @type {Number}
   */
  this.volume = 0;

  /**
   * Track panning
   * @type {Number}
   */
  this.pan = 0;

  /**
   * Number of scenes in the track
   * @type {Number}
   */
  this.numScenes = 0;

  /**
   * EventEmitter for track events
   * @type {EventEmitter}
   */
  this.eventEmitter = new EventEmitter();

  var self = this;

  /**
   * Listen for /live/send
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
   * Listen for /live/solo
   * @param  {Number} trackId the id of the track
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
   * Listen for /live/arm
   * @param  {Number} trackId the id of the track
   * @param  {Number} arm     0 or 1
   */
  function armListener(trackId, arm) {
    if (trackId != self.id) return;
    self.emitEvent('arm', {
      value: arm,
      prev: self.arm
    });
    self.arm = arm;
  }

  /**
   * Listen for /live/mute
   * @param  {Number} trackId the id of the track
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
   * Listen for /live/volume
   * @param  {Number} trackId the id of the track
   * @param  {Number} volume  new track volume
   */
  function volumeListener(trackId, volume) {
    if (trackId != self.id) return;
    self.emitEvent('volume', {
      value: volume,
      prev: self.volume
    });
    self.volume = volume;
  }

  /**
   * Listen for /live/pan
   * @param  {Number} trackId the id of the track
   * @param  {Number} pan     new track panning
   */
  function panListener(trackId, pan) {
    if (trackId != self.id) return;
    self.emitEvent('pan', {
      value: pan,
      prev: self.pan
    });
    self.pan = pan;
  }

  /**
   * Listen for /live/track/info
   * @param  {Number} trackId the id of the track
   * @param  {Number} arm     0 or 1
   * @param  {Number} solo    0 or 1
   * @param  {Number} mute    0 or 1
   * @param  {Number} audio   0 = midi, 1 = audio
   * @param  {Number} volume  current track volume
   * @param  {Number} pan     current track panning
   */
  function trackinfoListener(trackId, arm, solo, mute, audio, volume, pan) {
    if (trackId != self.id) return;
    self.arm = arm;
    self.solo = solo;
    self.mute = mute;
    self.audio = audio;
    this.volume = volume;
    this.pan = pan;
    self.emitEvent('arm', {
      value: arm,
      prev: self.arm
    });
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
    self.refreshClips();
  }

  /**
   * Listen for /live/devicelist
   */
  function devicelistListener() {
    var args = Array.prototype.slice.call(arguments, 0);
    var trackId = args.shift();
    if (trackId != self.id) return;
    // refresh all devices
    _.each(this.devices, function (device) {
      device.destroy();
    });
    this.devices = [];
    for (var i = 0; i < args.length; i += 2) {
      var deviceId = args[i];
      var deviceName = args[i + 1];
      self.devices.push(new Device(liveosc, deviceId, self, 'track', deviceName));
    }
  }

  /**
   * Listen for /live/name/track
   * This is called when clips/devices are added or removed
   * @param  {Number} trackId the id of the track
   * @param  {String} name    track name
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
    // this is called when clips or devices are added or removed
    // request new clip list
    liveosc.emitter.emit('/live/track/info', {type: 'integer', value: id});
    // request new device list
    liveosc.emitter.emit('/live/devicelist', {type: 'integer', value: id});
  }

  liveosc.receiver.on('/live/send', sendListener);
  liveosc.receiver.on('/live/solo', soloListener);
  liveosc.receiver.on('/live/arm', armListener);
  liveosc.receiver.on('/live/mute', muteListener);
  liveosc.receiver.on('/live/pan', panListener);
  liveosc.receiver.on('/live/volume', volumeListener);
  liveosc.receiver.on('/live/track/info', trackinfoListener);
  liveosc.receiver.on('/live/devicelist', devicelistListener);
  liveosc.receiver.on('/live/name/track', nameListener);

  /**
   * Called when a track is refreshed or destroyed
   */
  this.destroy = function () {
    this.eventEmitter.emit('destroy');
    this.eventEmitter.removeAllListeners();
    this.liveosc.receiver.removeListener('/live/send', sendListener);
    this.liveosc.receiver.removeListener('/live/solo', soloListener);
    this.liveosc.receiver.removeListener('/live/arm', armListener);
    this.liveosc.receiver.removeListener('/live/mute', muteListener);
    this.liveosc.receiver.removeListener('/live/pan', panListener);
    this.liveosc.receiver.removeListener('/live/volume', volumeListener);
    this.liveosc.receiver.removeListener('/live/track/info', trackinfoListener);
    this.liveosc.receiver.removeListener('/live/devicelist', devicelistListener);
    this.liveosc.receiver.removeListener('/live/name/track', nameListener);

    _.each(self.clips, function (clip) {
      clip.destroy();
    });
    this.clips = [];

    _.each(this.devices, function (device) {
      device.destroy();
    });
    this.devices = [];
  };

  liveosc.emitter.emit('/live/name/track', {type: 'integer', value: id});
  liveosc.emitter.emit('/live/send', {type: 'integer', value: id});
};

/**
 * Set the name of the track
 * @param {String} name the new track name
 */
Track.prototype.setName = function (name) {
  this.liveosc.emitter.emit(
    '/live/name/track',
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
 * Set the track arm state
 * @param {Number} arm 0 or 1
 */
Track.prototype.setArm = function (arm) {
  this.liveosc.emitter.emit(
    '/live/arm',
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: arm
    }
  );
};

/**
 * Set the track solo state
 * @param {Number} solo 0 or 1
 */
Track.prototype.setSolo = function (solo) {
  this.liveosc.emitter.emit(
    '/live/solo',
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
 * Set the track mute state
 * @param {Number} mute 0 or 1
 */
Track.prototype.setMute = function (mute) {
  this.liveosc.emitter.emit(
    '/live/mute',
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
 * Set the track volume
 * @param {Number} volume 0.0 - 1.0
 */
Track.prototype.setVolume = function (volume) {
  this.liveosc.emitter.emit(
    '/live/volume',
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
 * Set the track panning
 * @param {Number} pan -1.0 - 1.0
 */
Track.prototype.setPan = function (pan) {
  this.liveosc.emitter.emit(
    '/live/pan',
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
 * Set track send level
 * @param {Number} send send id
 * @param {Number} val  new send level (0.0 - 1.0)
 */
Track.prototype.setSend = function (send, val) {
  this.liveosc.emitter.emit(
    '/live/send',
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
 * Set number of scenes in the track
 * Called by Song
 * @param {Number} numScenes number of scenes in the track
 */
Track.prototype.setNumScenes = function (numScenes) {
  this.numScenes = numScenes;
};

/**
 * Refresh the state of all clips in the track
 */
Track.prototype.refreshClips = function () {
  _.each(this.clips, function (clip) {
    clip.destroy();
  });
  this.clips = [];

  for (var i = 0; i < this.numScenes; i++) {
    this.clips[i] = new Clip(this.liveosc, this, i);
    this.liveosc.emitter.emit(
      '/live/clip/info',
      {
        type: 'integer',
        value: this.id
      },
      {
        type: 'integer',
        value: i
      }
    );
  }
};

/**
 * Focus the track
 */
Track.prototype.view = function () {
  this.liveosc.emitter.emit(
    '/live/track/view',
    {
      type: 'integer',
      value: this.id
    }
  );
};

/**
 * Listen for a track event, current events are:
 *
 *   send
 *   solo
 *   arm
 *   mute
 *   volume
 *   pan
 *   name
 *   destroy
 * 
 * @param  {String}   ev event name
 * @param  {Function} cb callback
 */
Track.prototype.on = function (ev, cb) {
  this.eventEmitter.on(ev, cb);
};

/**
 * Emit a track event
 * @param  {String} ev     event name
 * @param  {Object} params event parameters
 */
Track.prototype.emitEvent = function (ev, params) {
  this.eventEmitter.emit(ev, params);
  this.liveosc.song.eventEmitter.emit(
    'track:' + ev,
    _.extend({id: this.id}, params)
  );
};

module.exports = Track;
