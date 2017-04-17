var WebSocket = require('faye-websocket'),
    ws        = new WebSocket.Client('ws://127.0.0.1:3000/');

ws.on('open', function(event) {
  console.log('open');
  ws.send('Hello, world!');
});

ws.on('message', function(event) {
  console.log('message', event.data);
});

ws.on('close', function(event) {
  console.log('close', event.code, event.reason);
  ws = null;
});


/******* Below is what I was messing around with after

var WebSocket = require('faye-websocket'),
    ws        = new WebSocket.Client('ws://127.0.0.1:3000/');
	//'wss://eandon-metadata.run.asv-pr.ice.predix.io/websocketendpoint/websocket'

// Start sending simple strings to the test channel on 1 second interval 
const AUTO_TEST = true;	
// Start sending json to the json channel on 1 second intervals 
const AUTO_JSON = false;
	
ws.on('open', function(event) {
  console.log('open');
  ws.send('Hello, world!');
});

ws.on('message', function(event) {
  console.log('message', event.data);
});

 // Subscribe to the test channel, and if a message is emitted by the server to the test channel,
 // call this function.  Note that you can change the name of the channels, but the server must also
 // be changed.
  
ws.on('test', function(event) {
    console.log('Received message from server on test channel: ', event.data);
});

 
 // Subscribe to the json channel, and if a message is emitted by the server to the test channel,
 // call this function.
 
ws.on('json', function(event){
    console.log('Received message from server on json channel: ', event.data);
})

ws.on('close', function(event) {
  console.log('close', event.code, event.reason);
  ws = null;
});

// Test sending messages - set constants at the top to true to use. 

if (AUTO_TEST){
    // Send a ping string to the test channel every second. 
    setInterval(() => {
        // emit sends data to a channel specified in the first argument. 
        ws.send('test');
    }, 1000);
}

if (AUTO_JSON){
        // Send a json message to the json channel every 3 seconds. 
    setInterval(() => {
        // JSON to send over socket 
        let testJSON = {
            "example" : "json",
            "timestamp" : new Date().toString()
        }
        // emit sends data to a channel specified in the first argument. 
       ws.emit('json', testJSON);
    }, 3000);
}
**********/