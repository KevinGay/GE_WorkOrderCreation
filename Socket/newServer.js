var WebSocket = require('faye-websocket'),
    http      = require('http');

//creates an http server
var server = http.createServer();

server.on('upgrade', function(request, socket, body) {
  if (WebSocket.isWebSocket(request)) {
    var ws = new WebSocket(request, socket, body); //initate the WebSocket handshake, server will receive the entire handshake from the client 
    
    ws.on('message', function(event) {
      ws.send(event.data); //buffers the message in memory until handshake is complete, any buffered messages will be sent to the client
    });
    
    ws.on('close', function(event) {
      console.log('close', event.code, event.reason);
      ws = null;
    });
  }
});

server.listen(3000);
