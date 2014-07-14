node-liveosc
============

node.js integration with Ableton Live via LiveOSC

## Prerequisites

You will need to have LiveOSC installed and running.  For best results, please use this version:

https://github.com/dinchak/LiveOSC

## Usage
Basic usage is as follows:

```javascript
// load LiveOSC class
var LiveOSC = require('liveosc');

// create new instance of LiveOSC, starts OSC listener
var liveosc = new LiveOSC({debug: true});

// triggered when Live is loaded and ready
liveosc.song.on('ready', function () {

  // start the song playing
  liveosc.song.play();
});
```

## Reference

See the [API docs](https://github.com/dinchak/node-liveosc/wiki) for full usage information.

### Song Structure
The LiveOSC object has a song property that contains a full object map of the current Live set.  The organization of the object is as follows:

#### Song
```javascript
{
  tempo: 120.0,
  tracks: [{Track}, {Track}, ...],
  returns: [{Return}, {Return}, ...],
  devices: [{Device}, {Device}, ...],
  volume: 0.0,
  pan: 0.0,
  scene: 0,
  beat: 0,
  playing: 1
}
```

#### Track
```javascript
{
  id: 0,
  name: '1-MIDI',
  clips: [{Clip}, {Clip}, ...],
  sends: [{id: 0, value: 1.0}, {id: 1, value: 1.0}, ...],
  devices: [{Device}, {Device}],
  audio: 0,
  solo: 0,
  mute: 0,
  arm: 0,
  volume: 0,
  pan: 0,
  numScenes: 0
}
```

#### Clip
```javascript
{
  id: 0,
  name: '',
  track: {Track},
  state: 0,
  coarse: 0,
  fine: 0,
  loopstart: 0,
  loopend: 0,
  loopstate: 0,
  warping: 0,
  length: 0
}
```

#### Return
```javascript
{
  id: 0,
  name: 'A-Reverb',
  sends: [{id: 0, value: 1.0}, {id: 1, value: 1.0}, ...],
  devices: [{Device}, {Device}],
  solo: 0,
  mute: 0,
  volume: 0,
  pan: 0
}
```

#### Device
```javascript
{
  id: 0,
  name: 'Reverb',
  track: {Track},
  type: 'return',
  params: [
    {
      id: 0,
      value: 1,
      name: 'Device On',
      min: 0,
      max: 1
    },
    {
      id: 1,
      value: 0.5555555820465088,
      name: 'PreDelay',
      min: 0,
      max: 1
    },
    ...
  ]
}
```

### Changing Parameters

Most parameters have a corresponding set function that can be called to change them.  For example, to set a clip's pitch, use the setPitch function:

```javascript
clip.setPitch(12);
```

There are also a number of events that can be triggered, such as playing a clip:

```javascript
clip.play();
```

See the [API docs](https://github.com/dinchak/node-liveosc/wiki) for a full reference.

### Events

Each object emits various events that can be listened for.  For example, to listen for changes to a clip's playing state (ie. the clip was started or stopped):

```javascript
clip.on('state', function (param) {
  // do something with param
});
```

```param``` will contain the new and previous values of the parameter, for example:

```javascript
{
  value: 1,
  prev: 0
}
```

Events can be listened at a global level as well.  Each clip, track, device, and return will prefix its events with the type (clip:state for example) and broadcast them through the song event emitter.  To listen for all clip state changes:

```javascript
liveosc.song.on('clip:state', function (param) {
  // do something with param
});
```

Additional parameters including the id of the object will be passed at the global level:

```javascript
{
  id: 0, // the clip id
  trackId: 0, // the track id the clip is on
  value: 1,
  prev: 0
}
```

See the [API docs](https://github.com/dinchak/node-liveosc/wiki) for a full reference.

### Using the REPL

A REPL is included to help with exploring the object model and how LiveOSC behaves:

```
$ node repl
LiveOSC> song.tracks[2].name;
'3-Audio'
LiveOSC> song.tracks[2].clips[1].name;
'test'
LiveOSC> song.tracks[2].clips[1].on('name', function (param) { console.log(param) });
undefined
LiveOSC> song.tracks[2].clips[1].setName('fresh jams');
undefined
{ value: 'fresh jams', prev: 'test' }
LiveOSC> song.tracks[2].clips[1].name;
'fresh jams'
LiveOSC>
```
