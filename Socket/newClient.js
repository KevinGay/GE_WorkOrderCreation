var quote;
function connect() {
  var WebSocket = require('faye-websocket'),
	//establish web socket connection to the endpoint
   ws = new WebSocket.Client('wss://test-eandon-metadata.run.aws-usw02-pr.ice.predix.io/websocketendpoint/websocket', [], {
	//proxy is required when on GE server 
    proxy: {
      origin:  'http://sjc1intproxy01.crd.ge.com:8080'
    },
    ping: 30
  });
  var options = {
    debug: true
  };
 //nodejs does not have a WebSocket object like browsers have, you must choose a websocket client and use webstomp.over instead of webstomp.client. 
  var webstomp = require('webstomp-client');
  var client = webstomp.over(ws, options);
 //A client instance can and should be created through webstomp.client or webstomp.over
  var headers = {
    login: '',
    passcode: ''
  };
    client.connect('','', function(frames){
	//Subscribe based on multiple location id 
	var location1 = client.subscribe('/websockets/locations/008bffa2-549e-4eb1-b5d8-de53fc0b3f00', function(message) 
	//var location2 = client.subscribe('/websockets/locations/008bffa2-549e-4eb1-b5d8-de53fc0b3f00', function(message) 	
	
	{
	//parse JSON file ....
    quote = JSON.parse(message.body);
	//prints parseJson return statement 
	console.log(parseJson(quote)); 
	
	
	}
	)
}
);  
};
 /*
     This parseJson function takes a json file and extract the alertId, alertType, assetId, siteId, comments, and statusType.
     Then connect to a database and:
        If the alertId does not exist in the database and the statusType is 'Initiate', insert it with the fields listed above.
        If the alertId is already in the database and the statusType is not 'Initiate', update the current alertId
            to show the new status followed by the new comments.
     If any error occurs, show the log in the console and write it to the log file. Also log any JSON that comes through
        into the log file.
     alertId : primary key in staging area. Uniquely identifies alerts.
     alertType : specifies what kind of alert is being created.
     assetId : identifies machine that the alert is addressing.
     siteId : the location of the machine.
     comments: anything extra that the user wants to include about the alert.
     statusType: whether the alert is being initiated or updated.
     */
function parseJson (inJson) {	
    var alertId = inJson['alert']['id'];
    var alertType = inJson['alert']['alertDefinition']['alertType']['name'];
    var assetId = 'TEST_ASSET_ID';
    var siteId = inJson['alert']['alertDefinition']['locationId'];
    var comments = inJson['alert']['alertComments'][0]['alertComment'];
    var statusType = inJson['type'];
    var timeStamp = inJson['timestamp'];

    return [timeStamp, alertId, alertType, assetId, siteId, comments, statusType];
	//alertId - prime key in eandon
	//siteId - must start with "M00"

};


connect();
//parseJson(quote);





