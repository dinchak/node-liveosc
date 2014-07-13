var repl = require('repl');

var LiveOSC = require('./index');
var liveosc = new LiveOSC();

var server = repl.start({
  prompt: 'LiveOSC> '
});

server.context.song = liveosc.song;
