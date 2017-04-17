var WebSocket = require('faye-websocket'),
    http      = require('http');

var server = http.createServer();

server.on('upgrade', function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    var ws = new WebSocket(request, socket, body);
    
    ws.on('message', function(event) {
      ws.send(event.data);
    });
    
    ws.on('close', function(event) {
      console.log('close', event.code, event.reason);
      ws = null;
    });
  }
});

server.listen(3000);


/***** Below is what I was messing around with after

// Create WebSocket variable 
var WebSocket 	= require('faye-websocket'),
	EventSource = WebSocket.EventSource,
    http      	= require('http');

var server = http.createServer();

// On 'upgrade' event perform one of the following nested functions
// based on what channel data comes through
server.on('upgrade', function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    var ws = new WebSocket(request, socket, body);
	
    
	ws.on('open', function(event) {
		console.log('Server - connected to client successfully');
		send('Successful Connection!');
	});
	
    ws.on('message', function(event) {
      console.log('we are in messages');
	  ws.emit(event.data);
    });
	
	ws.on('test', function(event) {
		//ws.send(event.data)
        console.log('Server - Recieved data from client on test: ');
        ws.emit('test', 'Got It - test!');
    });
    
    ws.on('close', function(event) {
      console.log('close', event.code, event.reason);
      ws = null;
    });
  }
});

server.listen(3000);
******/