/* 
 * Import the socket.io client, and attempt to connect to the host and port specified.
 * Note that the socket will go ahead and attempt to connect to the server.
 * All the handlers defined below will be called by the socket, you do not have 
 * to call them.  
 */
const socket = require('socket.io-client')('http://127.0.0.1:3000');

/* Start sending simple strings to the test channel on 1 second interval */
const AUTO_TEST = false;
/* Start sending json to the json channel on 1 second intervals */
const AUTO_JSON = true;



/* When the client makes a connection, call this function */
socket.on('connect', () => {
    console.log('Connected.');
});

/* 
 * Message is a reserved channel for the socket client and server to use. If the server,
 * sends a message, call this function.
 */
socket.on('message', (message) => {
    console.log(message);
})

/* 
 * Subscribe to the test channel, and if a message is emitted by the server to the test channel,
 * call this function.  Note that you can change the name of the channels, but the server must also
 * be changed.
 */ 
socket.on('test', (data) => {
    console.log('Received message from server on test channel: ', data);
});

/* 
 * Subscribe to the json channel, and if a message is emitted by the server to the test channel,
 * call this function.
 */ 
socket.on('json', (data) =>{
    console.log('Received message from server on json channel: ', data);
})

/* If the client disconnects from the server, call this function */
socket.on('disconnect', () =>{
    console.log('Disconnected');
});

/* If an error occurs while trying to connect to the server, call this function with the error */
socket.on('connect_error', (err) => {
    console.log('Connection Error - ', err);
});

/* If the socket trys to reconnect, call this function with the number of times it has tried this */
socket.on('reconnecting', (index) =>{
    console.log('Attempting to reconnect, count: ', index);
});

/* If the socket has an error during the reconnection, call this function with the error */
socket.on('reconnect-error', (err) => {
    console.log('Reconnection error - ', err);
});


/***** Test sending messages - set constants at the top to true to use. *****/

if (AUTO_TEST){
    /* Send a ping string to the test channel every second. */
    setInterval(() => {
        /* emit sends data to a channel specified in the first argument. */
        socket.emit('test', 'ping');
    }, 1000);
}

if (AUTO_JSON){
        /* Send a json message to the json channel every 3 seconds. */
    setInterval(() => {
        /* JSON to send over socket */
        let testJSON = {
            "example" : "json",
            "timestamp" : new Date().toString()
        }
        /* emit sends data to a channel specified in the first argument. */
        socket.emit('json', testJSON);
    }, 3000);
}

/* NEED TO KNOW
GE EAM server address? port?
How can we tell when alert is created? is this on eAndon?
Parse before/after?
Where is JSON before being sent? immediately after creation?