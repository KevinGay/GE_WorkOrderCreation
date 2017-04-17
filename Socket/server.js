/* Use node's built in http server as the base */
const server = require('http').createServer();
/* Use socket.io on top of the server we just created */
const io = require('socket.io')(server);
/* Run the server on port 3000 - Client must use this. */
const PORT = 3000;
/* Run on the localhost (loopback) - Client must use this. */
const HOST = 'localhost';

/*
 * When a client connects to the server, call this function.
 * Note that when this occurs, that each client is within
 * this scope.  The client passed in can then be used 
 * to respond to just that client
 */ 
io.on('connection', (client) => {
    console.log('Client connected to server.');
    /* Send a welcome message on the reserved message channel */
    client.send('Welcome to the server!!!');
    /* When a client emits a test event, call this function */
    client.on('test', (data) => {
        console.log('Server - Recieved data from client on test: ', data);
        client.emit('test', 'Got It - test!');
    });

    /* When a client emits a json event, call this function */
    client.on('json', (data) =>{
        console.log('Server - Recieved data from client on json: ', data);
        client.emit('json', 'Got It - json!');
    });

    /* When a client disconnects, call this function */
    client.on('disconnect', () =>{
        console.log('Client Disconnected');
    });



});

console.log(`Listening on Port: ${PORT} of Host: ${HOST}`);
/* Begin listening for connections on localhost (loopback) port 3000 - make sure client connects to same.*/
server.listen(PORT, HOST);

