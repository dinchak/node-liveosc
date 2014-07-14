/**
 * @module node-liveosc
 * @author Tom Dinchak <dinchak@gmail.com>
 */

var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;

/**
 * Clip object, represents a clip in the Ableton Live set.
 * @constructor
 * @param {Object} liveosc LiveOSC instance
 * @param {Object} track   Track this Clip belongs to
 * @param {Number} id      id of the clip
 */
var Clip = function (liveosc, track, id) {

  /**
   * Instance of LiveOSC
   * @type {Object}
   */
  this.liveosc = liveosc;

  /**
   * The track this clip belongs to
   * @type {Object}
   */
  this.track = track;

  /**
   * The id of this clip
   * @type {Number}
   */
  this.id = id;

  /**
   * The name of this clip
   * @type {String}
   */
  this.name = false;

  /**
   * The playing state of this clip
   * 
   *   0 = empty (no clip)
   *   1 = stopped
   *   2 = playing
   *   3 = triggered
   *   
   * @type {Number}
   */
  this.state = 0;

  /**
   * The coarse pitch of the clip (audio clips only)
   * @type {Number}
   */
  this.coarse = 0;

  /**
   * The fine pitch of the clip (audio clips only)
   * @type {Number}
   */
  this.fine = 0;

  /**
   * The loop start position of the clip in beats
   * @type {Number}
   */
  this.loopstart = 0;

  /**
   * The loop end position of the clip in beats
   * @type {Number}
   */
  this.loopend = 0;

  /**
   * The loop enabled state of the clip
   * @type {Number}
   */
  this.loopstate = 0;

  /**
   * The warping mode of the clip
   * 
   *   0 = Beats
   *   1 = Tones
   *   2 = Texture
   *   3 = Repitch
   *   4 = Complex
   *   5 = Complex Pro
   *   
   * @type {Number}
   */
  this.warping = 0;

  /**
   * The length of the clip in beats
   * @type {Number}
   */
  this.length = 0;

  /**
   * EventEmitter for clip events
   * @type {EventEmitter}
   */
  this.eventEmitter = new EventEmitter();

  var self = this;

  /**
   * Listen for /live/clip/loopstart
   * @param  {Number} trackId   the id of the track
   * @param  {Number} clipId    the id of the clip
   * @param  {Number} loopstart the new loopstart position
   */
  function loopstartListener(trackId, clipId, loopstart) {
    if (self.track.id != trackId) return;
    if (self.id != clipId) return;
    self.emitEvent('loopstart', {
      value: loopstart,
      prev: self.loopstart
    });
    self.loopstart = loopstart;
  }

  /**
   * Listen for /live/clip/loopend
   * @param  {Number} trackId   the id of the track
   * @param  {Number} clipId    the id of the clip
   * @param  {Number} loopend   the new loopend position
   */
  function loopendListener(trackId, clipId, loopend) {
    if (self.track.id != trackId) return;
    if (self.id != clipId) return;
    self.emitEvent('loopend', {
      value: loopend,
      prev: self.loopend
    });
    self.loopend = loopend;
  }

  /**
   * Listen for /live/clip/loopstate
   * @param  {Number} trackId   the id of the track
   * @param  {Number} clipId    the id of the clip
   * @param  {Number} loopstate the new loop state
   */
  function loopstateListener(trackId, clipId, loopstate) {
    if (self.track.id != trackId) return;
    if (self.id != clipId) return;
    self.emitEvent('loopstate', {
      value: loopstate,
      prev: self.loopstate
    });
    self.loopstate = loopstate;
  }

  /**
   * Listen for /live/clip/warping
   * @param  {Number} trackId   the id of the track
   * @param  {Number} clipId    the id of the clip
   * @param  {Number} warping   the new warping state
   */
  function warpingListener(trackId, clipId, warping) {
    if (self.track.id != trackId) return;
    if (self.id != clipId) return;
    self.emitEvent('warping', {
      value: warping,
      prev: self.warping
    });
    self.warping = warping;
  }

  /**
   * Listen for /live/pitch
   * @param  {Number} trackId   the id of the track
   * @param  {Number} clipId    the id of the clip
   * @param  {Number} coarse    the new coarse pitch
   * @param  {Number} fine      the new fine pitch
   */
  function pitchListener(trackId, clipId, coarse, fine) {
    if (self.track.id != trackId) return;
    if (self.id != clipId) return;
    self.emitEvent('coarse', {
      value: coarse,
      prev: self.coarse
    });
    self.emitEvent('fine', {
      value: fine,
      prev: self.fine
    });
    self.coarse = coarse || 0;
    self.fine = fine || 0;
  }

  /**
   * Listen for /live/clip/info
   * @param  {Number} trackId   the id of the track
   * @param  {Number} clipId    the id of the clip
   * @param  {Number} state     the new playing state of the clip
   * @param  {Number} length    the new length of the clip
   */
  function clipinfoListener(trackId, clipId, state, length) {
    if (self.track.id != trackId) return;
    if (self.id != clipId) return;
    self.emitEvent('state', {
      value: state,
      prev: self.state
    });
    self.state = state;
    self.length = length;

    if (state > 0) {
      self.refresh();
    } else {
      self.name = '';
    }
  }

  /**
   * Listen for /live/clip/name
   * @param  {Number} trackId   the id of the track
   * @param  {Number} clipId    the id of the clip
   * @param  {String} name      the new name of the track
   */
  function clipnameListener(trackId, clipId, name) {
    if (self.track.id != trackId) return;
    if (self.id != clipId) return;
    self.emitEvent('name', {
      value: name,
      prev: self.name
    });
    self.name = name;
    var trackArg = {type: 'integer', value: self.track.id};
    var clipArg = {type: 'integer', value: self.id};
    // this message fires whe clips are added or deleted
    // request clip info for this slot
    self.liveosc.emitter.emit('/live/clip/info', trackArg, clipArg);
  }

  liveosc.receiver.on('/live/clip/loopstart', loopstartListener);
  liveosc.receiver.on('/live/clip/loopend', loopendListener);
  liveosc.receiver.on('/live/clip/loopstate', loopstateListener);
  liveosc.receiver.on('/live/clip/warping', warpingListener);
  liveosc.receiver.on('/live/pitch', pitchListener);
  liveosc.receiver.on('/live/clip/info', clipinfoListener);
  liveosc.receiver.on('/live/name/clip', clipnameListener);

  /**
   * Called when a clip is refreshed or destroyed
   */
  this.destroy = function () {
    this.eventEmitter.emit('destroy');
    this.eventEmitter.removeAllListeners();
    this.liveosc.receiver.removeListener('/live/clip/loopstart', loopstartListener);
    this.liveosc.receiver.removeListener('/live/clip/loopend', loopendListener);
    this.liveosc.receiver.removeListener('/live/clip/loopstate', loopstateListener);
    this.liveosc.receiver.removeListener('/live/clip/warping', warpingListener);
    this.liveosc.receiver.removeListener('/live/pitch', pitchListener);
    this.liveosc.receiver.removeListener('/live/clip/info', clipinfoListener);
    this.liveosc.receiver.removeListener('/live/name/clip', clipnameListener);
  };
};

/**
 * Refresh the state of the clip
 */
Clip.prototype.refresh = function () {
  var trackArg = {type: 'integer', value: this.track.id};
  var clipArg = {type: 'integer', value: this.id};
  this.liveosc.emitter.emit('/live/clip/loopstart', trackArg, clipArg);
  this.liveosc.emitter.emit('/live/clip/loopend', trackArg, clipArg);
  this.liveosc.emitter.emit('/live/clip/loopstate', trackArg, clipArg);
  if (this.track.audio) {
    this.liveosc.emitter.emit('/live/clip/warping', trackArg, clipArg);
    this.liveosc.emitter.emit('/live/pitch', trackArg, clipArg);
  }
  if (this.name === false) {
    this.liveosc.emitter.emit('/live/name/clip', trackArg, clipArg);
  }
};

/**
 * Trigger the clip to start playing
 */
Clip.prototype.play = function () {
  this.liveosc.emitter.emit(
    '/live/play/clipslot',
    {
      type: 'integer',
      value: this.track.id
    },
    {
      type: 'integer',
      value: this.id
    }
  );
};

/**
 * Trigger the clip to stop playing
 */
Clip.prototype.stop = function () {
  this.liveosc.emitter.emit(
    '/live/stop/clip',
    {
      type: 'integer',
      value: this.track.id
    },
    {
      type: 'integer',
      value: this.id
    }
  );
};

/**
 * Set the name of the clip
 * @param {String} name the new clip name
 */
Clip.prototype.setName = function (name) {
  this.liveosc.emitter.emit(
    '/live/name/clip',
    {
      type: 'integer',
      value: this.track.id
    },
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
 * Set the pitch of the clip (audio only)
 * @param {Number} coarse the coarse pitch of the clip
 * @param {Number} fine   the fine pitch of the clip
 */
Clip.prototype.setPitch = function (coarse, fine) {
  if (!this.track.audio) {
    return;
  }
  this.liveosc.emitter.emit(
    '/live/pitch',
    {
      type: 'integer',
      value: this.track.id
    },
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: coarse
    },
    {
      type: 'integer',
      value: fine || 0
    }
  );
};

/**
 * Sets the loop start position of the clip in beats
 * @param {Number} loopstart the loop start position in beats
 */
Clip.prototype.setLoopstart = function (loopstart) {
  this.liveosc.emitter.emit(
    '/live/clip/loopstart',
    {
      type: 'integer',
      value: this.track.id
    },
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: loopstart
    }
  );
};

/**
 * Sets the loop end position of the clip in beats
 * @param {Number} loopend the loop end position in beats
 */
Clip.prototype.setLoopend = function (loopend) {
  this.liveosc.emitter.emit(
    '/live/clip/loopend',
    {
      type: 'integer',
      value: this.track.id
    },
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: loopend
    }
  );
};

/**
 * Enable or disable looping of the clip
 * @param {Number} loopstate 0 to disable, 1 to enable
 */
Clip.prototype.setLoopstate = function (loopstate) {
  this.liveosc.emitter.emit(
    '/live/clip/loopstate',
    {
      type: 'integer',
      value: this.track.id
    },
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: loopstate
    }
  );
};

/**
 * Set the warping mode of the clip
 * 
 *   0 = Beats
 *   1 = Tones
 *   2 = Texture
 *   3 = Repitch
 *   4 = Complex
 *   5 = Complex Pro
 * 
 * @param {Number} warping the new warping mode
 */
Clip.prototype.setWarping = function (warping) {
  this.liveosc.emitter.emit(
    '/live/clip/warping',
    {
      type: 'integer',
      value: this.track.id
    },
    {
      type: 'integer',
      value: this.id
    },
    {
      type: 'integer',
      value: warping
    }
  );
};

/**
 * Focus the clip
 */
Clip.prototype.view = function () {
  this.liveosc.emitter.emit(
    '/live/clip/view',
    {
      type: 'integer',
      value: this.id
    }
  );
};

/**
 * Listen for a clip event, current events are:
 *
 *   state
 *   loopstart
 *   loopend
 *   loopstate
 *   warping
 *   coarse
 *   fine
 *   name
 *   destroy
 * 
 * @param  {string}   ev event name
 * @param  {Function} cb callback
 */
Clip.prototype.on = function (ev, cb) {
  this.eventEmitter.on(ev, cb);
};

/**
 * Emit a clip event
 * @param  {String} ev     event name
 * @param  {Object} params event parameters
 */
Clip.prototype.emitEvent = function (ev, params) {
  this.eventEmitter.emit(ev, params);
  this.liveosc.song.eventEmitter.emit(
    'clip:' + ev,
    _.extend({id: this.id, trackId: this.track.id}, params)
  );
};

module.exports = Clip;
