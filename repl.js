var repl = require('repl');

var LiveOSC = require('./app');
var liveosc = new LiveOSC({debug: true});

var server = repl.start({
  prompt: 'LiveOSC> '
});

server.context.song = liveosc.song;
