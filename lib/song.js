/**
 * @module node-liveosc
 * @author Tom Dinchak <dinchak@gmail.com>
 */

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var Track = require('./track');
var Return = require('./return');
var Device = require('./device');

/**
 * Song object, represents the current state of the Ableton Live
 * set.  Contains tracks, returns, and devices, as well as master
 * track properties.
 * @constructor
 * @param {Object} liveosc LiveOSC instance
 */
var Song = function (liveosc) {

  /**
   * LiveOSC instance
   * @type {Object}
   */
  this.liveosc = liveosc;

  /**
   * Current tempo
   * @type {Number}
   */
  this.tempo = 120.0;

  /**
   * Current tracks
   * @type {Array}
   */
  this.tracks = [];

  /**
   * Current return tracks
   * @type {Array}
   */
  this.returns = [];

  /**
   * Current devices
   * @type {Array}
   */
  this.devices = [];

  /**
   * Master track volume
   * @type {Number}
   */
  this.volume = 0;

  /**
   * Master track panning
   * @type {Number}
   */
  this.pan = 0;

  /**
   * Currently selected scene
   * @type {Number}
   */
  this.scene = 0;

  /**
   * Current beat/play position
   * @type {Number}
   */
  this.beat = 0;

  /**
   * Transport play state, 1 = stopped, 2 = playing 
   * @type {Number}
   */
  this.playing = 1;

  /**
   * EventEmitter for song events
   * @type {EventEmitter}
   */
  this.eventEmitter = new EventEmitter();

  var self = this;

  /**
   * Respond to /live/play
   * Called when the song starts or stops
   * @param  {Number} play state (1 = stopped, 2 = playing)
   */
  function playListener(playing) {
    self.eventEmitter.emit('play', {
      value: playing,
      prev: self.playing
    });
    self.playing = playing;
  }

  /**
   * Respond to /live/beat
   * Called when a beat is reached in the song timeline
   * @param  {Number} new beat
   */
  function beatListener(beat) {
    self.eventEmitter.emit('beat', {
      value: beat,
      prev: self.beat
    });
    self.beat = beat;
  }

  /**
   * Respond to /live/tempo
   * Called when tempo changes
   * @param  {Number} tempo new tempo
   */
  function tempoListener(tempo) {
    self.eventEmitter.emit('tempo', {
      value: tempo,
      prev: self.tempo
    });
    self.tempo = tempo;
  }

  /**
   * Respond to /live/scene
   * Called when scene changes
   * @param  {Number} scene new scene number
   */
  function sceneListener(scene) {
    self.eventEmitter.emit('scene', {
      value: scene,
      prev: self.scene
    });
    self.scene = scene;
  }

  /**
   * Respond to /live/master/volume
   * Called when master track volume changes
   * @param  {Number} volume new volume (0.0 - 1.0)
   */
  function volumeListener(volume) {
    self.eventEmitter.emit('volume', {
      value: volume,
      prev: self.volume
    });
    self.volume = volume;
  }

  /**
   * Respond to /live/master/pan
   * Called when master track panning changes
   * @param  {Number} pan new panning (-1.0 - 1.0)
   */
  function panListener(pan) {
    self.eventEmitter.emit('pan', {
      value: pan,
      prev: self.pan
    });
    self.pan = pan;
  }

  /**
   * Repond to /live/tracks
   * Called when number of tracks is reported
   * @param  {Number} numTracks new number of tracks
   */
  function tracksListener(numTracks) {
    for (var i = 0; i < numTracks; i++) {
      self.tracks[i] = new Track(liveosc, i);
    }
    // request number of scenes
    liveosc.emitter.emit('/live/scenes');
  }

  /**
   * Respond to /live/returns
   * Called when number of returns is reported
   * @param  {Number} numTracks number of returns
   */
  function returnsListener(numTracks) {
    for (var i = 0; i < numTracks; i++) {
      self.returns[i] = new Return(liveosc, i);
    }
  }

  /**
   * Respond to /live/scenes
   * Called when number of scenes is reported
   * @param  {Number} numScenes number of scenes
   */
  function scenesListener(numScenes) {
    for (var i = 0; i < self.tracks.length; i++) {
      self.tracks[i].setNumScenes(numScenes);
      self.tracks[i].refreshClips();
    }
  }

  /**
   * Respond to /live/master/devicelist
   * Called when device list is received
   */
  function devicelistListener() {
    var args = Array.prototype.slice.call(arguments, 0);
    for (var i = 0; i < args.length; i += 2) {
      var deviceId = args[i];
      var deviceName = args[i + 1];
      self.devices.push(new Device(liveosc, deviceId, self, 'master', deviceName));
    }
  }

  /**
   * Respond to:
   * /remix/oscserver/startup
   * /remix/oscserver/shutdown
   * /live/refresh
   * Refreshes the current song state
   */
  function refreshListener() {
    self.refresh();
  }
  liveosc.receiver.on('/live/play', playListener);
  liveosc.receiver.on('/live/beat', beatListener);
  liveosc.receiver.on('/live/tempo', tempoListener);
  liveosc.receiver.on('/live/scene', sceneListener);
  liveosc.receiver.on('/live/master/volume', volumeListener);
  liveosc.receiver.on('/live/master/pan', panListener);
  liveosc.receiver.on('/live/tracks', tracksListener);
  liveosc.receiver.on('/live/returns', returnsListener);
  liveosc.receiver.on('/live/scenes', scenesListener);
  liveosc.receiver.on('/live/master/devicelist', devicelistListener);
  liveosc.receiver.on('/remix/oscserver/startup', refreshListener);
  liveosc.receiver.on('/remix/oscserver/shutdown', refreshListener);
  liveosc.receiver.on('/live/refresh', refreshListener);

  // use /live/time to indicate live is ready
  liveosc.receiver.on('/live/time', function () {
    self.eventEmitter.emit('ready');
  });

  this.refresh();
};

/**
 * Refresh the current song state
 * Recreates all tracks/returns/clips
 */
Song.prototype.refresh = function () {
  this.eventEmitter.emit('refresh');

  _.each(this.tracks, function (track) {
    track.destroy();
  });

  this.tracks = [];
  _.each(this.returns, function (ret) {
    ret.destroy();
  });

  this.returns = [];
  _.each(this.devices, function (device) {
    device.destroy();
  });

  this.devices = [];
  this.liveosc.emitter.emit('/live/tracks');
  this.liveosc.emitter.emit('/live/returns');
  this.liveosc.emitter.emit('/live/master/volume');
  this.liveosc.emitter.emit('/live/master/pan');
  this.liveosc.emitter.emit('/live/tempo');
  this.liveosc.emitter.emit('/live/master/devicelist');

  var self = this;
  setTimeout(function () {
    self.liveosc.emitter.emit('/live/time');
  }, this.liveosc.waitTime);
};

/**
 * Trigger song stop
 */
Song.prototype.stop = function () {
  this.liveosc.emitter.emit('/live/stop');
};

/**
 * Trigger song play
 */
Song.prototype.play = function () {
  this.liveosc.emitter.emit('/live/play');
};

/**
 * Trigger song continue play
 */
Song.prototype.continue = function () {
  this.liveosc.emitter.emit('/live/play/continue');
};

/**
 * Move to next cue marker
 */
Song.prototype.nextCue = function () {
  this.liveosc.emitter.emit('/live/next/cue');
};

/**
 * Move to previous cue marker
 */
Song.prototype.prevCue = function () {
  this.liveosc.emitter.emit('/live/prev/cue');
};

/**
 * Trigger undo
 */
Song.prototype.undo = function () {
  this.liveosc.emitter.emit('/live/undo');
};

/**
 * Trigger redo
 */
Song.prototype.redo = function () {
  this.liveosc.emitter.emit('/live/redo');
};

/**
 * Focus the master track
 */
Song.prototype.view = function () {
  this.liveosc.emitter.emit('/live/master/view');
};

/**
 * Trigger a scene play button
 * @param  {Number} scene scene number to play
 */
Song.prototype.playScene = function (scene) {
  this.liveosc.emitter.emit(
    '/live/scene',
    {
      type: 'integer',
      value: scene
    }
  );
};

/**
 * Sets the master track volume
 * @param {Number} volume new volume
 */
Song.prototype.setVolume = function (volume) {
  this.liveosc.emitter.emit('/live/master/volume',
    {
      type: 'float',
      value: volume
    }
  );
};

/**
 * Sets the master track panning
 * @param {Number} pan new panning
 */
Song.prototype.setPan = function (pan) {
  this.liveosc.emitter.emit('/live/master/pan',
    {
      type: 'float',
      value: pan
    }
  );
};

/**
 * Sets the tempo
 * @param {Number} tempo new tempo
 */
Song.prototype.setTempo = function (tempo) {
  this.liveosc.emitter.emit('/live/tempo',
    {
      type: 'float',
      value: tempo
    }
  );
};

/**
 * Listen for a song event, current events are:
 * 
 *   ready
 *   play
 *   beat
 *   tempo
 *   scene
 *   volume
 *   pan
 *   
 * @param  {String}   ev event name
 * @param  {Function} cb callback
 */
Song.prototype.on = function (ev, cb) {
  this.eventEmitter.on(ev, cb);
};

module.exports = Song;
