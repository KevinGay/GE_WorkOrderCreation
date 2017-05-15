
/*
Sock.js file sets up a websocket connection using a subscription based on the location id's, parsed the JSON file when a change is made in eAndon, establishes connection 
to the Oracle staging table database and inserts or changes entries into table, and establishes an API get comments.
Any action doene through the websocket is written to a log file 
*/


var quote;
var geproxy = 'http://sjc1intproxy01.crd.ge.com:8080';
var websocketendpoint = 'wss://eandon-metadata.run.asv-pr.ice.predix.io/websocketendpoint/websocket';
var invalidAssetError = "Invalid asset id, workorder was not created. Please create a new alert and include the asset id in the comments. ";

//location id subscriptions
var facilites = '/websockets/locations/13492a1b-1805-4b8c-9aea-6d6d3f50056e';
var fmo = '/websockets/locations/892e99c0-9318-4839-9f71-b1945569f590';
var sco = '/websockets/locations/ae0cb684-6d22-42df-a7da-572bb1b1875c';
var fco = '/websockets/locations/f7bfb6ed-5471-4a69-823c-89297c0f2e54';

var facilitiesId = '13492a1b-1805-4b8c-9aea-6d6d3f50056e';
var fmoId = '892e99c0-9318-4839-9f71-b1945569f590';
var scoId = 'ae0cb684-6d22-42df-a7da-572bb1b1875c';
var fcoId = 'f7bfb6ed-5471-4a69-823c-89297c0f2e54';

//Staging table name 
var tableName = "GEPSEAM.GEPS_EAM_MAINTENENCE_WO";

//location of logfile.txt
var pathtolog = 'logfile.txt';

//variables for API
var postmantoken = 'd305305b-68ca-c5be-6ac6-288f895df88f';
var cachecontrol = 'no-cache';
var authorization = 'GVhbHRoY2FyZV9icmlsbGlhbnRfYXBwc19odWJfZWFuZG9uX3Byb2Q6NEZ3NDRSbGV1bVRweHNlOA==';
var contenttype = 'application/x-www-form-urlencoded';
var granttype = 'client_credentials';
//Authorization token for test environment that gives permission and access to use the API
var authtoken = 'https://a99b7fee-a495-4161-89c3-faa83054627d.predix-uaa.run.asv-pr.ice.predix.io/oauth/token';
//comment url to comment on an alert 
var commenturl = 'https://eandon-metadata.run.asv-pr.ice.predix.io/api/v1/alerts/';
var postmantokencomment = 'cde0dbc5-4fb4-c42e-e8ab-4d17b5a78807';
var cachecontrolcomment = 'no-cache';
var contenttypecomment = 'application/json';

/*
	Establishes websocket connection to eAndon and parses a JSON message 
*/ 
function connect() {
  var WebSocket = require('faye-websocket'),
	//establish web socket connection to the endpoint
   ws = new WebSocket.Client(websocketendpoint, [], {
	//proxy is required when on GE server 
    proxy: {
      origin:  geproxy
    },
	// sends a 'ping' message every 30 milliseconds through the socket to client side to keep connection alive
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
		
	//Subscribe based on location id 
	var locationone = client.subscribe(fmo, function(message) 	
	{
	
	//parse JSON file ....
	//maps data from message to JSON
    quote = JSON.parse(message.body);
	//calls parseJson function 
	parseJson(quote);	
	}
	)
	
	var locationtwo = client.subscribe(fco, function(message)
	{
	
	//parse JSON file ....
	//maps data from message to JSON
    quote = JSON.parse(message.body);
	//calls parseJson function 
	parseJson(quote);	
	}
	)
	
	var locationthree = client.subscribe(sco, function(message)
	{
	
	//parse JSON file ....
	//maps data from message to JSON
    quote = JSON.parse(message.body);
	//calls parseJson function 
	parseJson(quote);	
	}
	)	
	
	var locationfour = client.subscribe(facilites, function(message)
	{
	
	//parse JSON file ....
	//maps data from message to JSON
    quote = JSON.parse(message.body);
	//calls parseJson function 
	parseJson(quote);	
	}
	)
	
	
}
);  
 
};


 /*
    Append a message to a log file, which will save the date and time at which the action occurred and
        either: an error message that was returned by Oracle or the JSON file that was altered or inserted.
*/
function writeToLog(errMessage) {  

    //fs is required to create/write to the log file
    var fs = require('fs');

    //Create new date object, which stores the current date & time by default
    var dateTime = new Date();

	// updates logfile.txt 	
    fs.appendFile(pathtolog, dateTime + ":\t" + errMessage + "\n", function (err) {
        if (err) throw err;
        console.log("Written to log: " + errMessage);
    });
}



function parseJson (inJson) { 
	/*
     Take a json file and extract the alertId, assetId, siteId, alertType, statusType, timeStamp, sso and comments.
     Then connect to a database and:
        If the alertId does not exist in the database and the statusType is 'Initiate', insert it with the fields listed above.
        If the alertId is already in the database and the statusType is not 'Initiate', update the current alertId
            to show the new status followed by the new comments.
     If any error occurs, show the log in the console and write it to the log file. Also log any JSON that comes through
        into the log file.
     alertId : primary key in staging area. Uniquely identifies alerts.
     assetId : identifies machine that the alert is addressing. This is found by calling the API to the asset model and passing
        it the siteId.
     siteId : the location of the machine.
     alertType : specifies what kind of alert is being created.
     statusType: whether the alert is being initiated or updated.
	 sso: users sso number 
     comments: anything extra that the user wants to include about the alert.
	*/
	
	
	//try catch statement to verify the function parameter inJson and addresses undefined variables
	try{
		if (inJson == "") throw "inJson is empty";
	}
	
	catch(err){
		writeToLog("Error:", err.message);
	}
	
	//parses the inJson message for alertId, siteId, alertType, statusType, timeStamp, sso and comments 
    var alertId = inJson['alert']['id'];
    var siteId = inJson['alert']['alertDefinition']['locationId'];
    var alertType = inJson['alert']['alertDefinition']['alertType']['name'];
    var statusType = inJson['type'];
    var timeStamp = inJson['timestamp'];
	var sso = inJson['alert']['alertComments']['sso'];
	
	//Ignore alert type that are not for maintenance
	if (alertType != 'Maintenance') {
        return;
     } 

    //Add all comments for status updates only
    var comments = [];
    //Comments get stored in the staging area with the comments to tell when something happened. Indices in the array correspond to comments
    var commentsWithType = [];
	//lops through alert comments and finds the comment and the commentType
    for (var i = 0; i < inJson['alert']['alertComments'].length; i++)
    {
        comment = inJson['alert']['alertComments'][i]['alertComment'];
        commentType = inJson['alert']['alertComments'][i]['alertCommentType'];
        if (commentType == "General" || commentType == "Escalate" || commentType == "Pause" || commentType == "Sla") {
            //Ignore all of the comments that aren't associated with status updates b/c not needed for work order  
        }
        else if (comment != invalidAssetError) {
			// If comments are associated with a status update, add the statusType and the updated comment to the comment array.
            comments.push(comment);
            commentsWithType.push(commentType + ":" + comment);
        }
    }

    //Gets assetId from first comment entered from user
    var assetId = comments.toString().substring(0,8);     
	
     // SCO - If the assetId does not start with 'M00' return an invalid assetId error back to eAndon and write it to logFile.
	 // FCO - If the assetId does not start with 'E00' return an invalid assetId error back to eAndon and write it to logFile.
     // Note: Only send error if statusType is initiate because an asset ID already exists in the staging area so it doesn't matter what the comments are.
     // TODO: Add in the handling for the FCO, FMO, Facilities, and WFSC site asset IDs in this if statement below!
	
     if (!assetId.startsWith('M00') && statusType == "Initiate" && siteId == scoId) {
     //Send error back to eAndon through API and update log
		writeToLog("(ALERTID=" + alertId + ") " + "Invalid asset ID given. Expected asset ID starting with M00, but given asset ID is " + assetId);
		getToken(alertId,sso);
		return;
     }
	 else if (!assetId.startsWith('E00') && statusType == "Initiate" && siteId == fcoId) {
		//Send error back to eAndon through API and update log
		writeToLog("(ALERTID=" + alertId + ") " + "Invalid asset ID given. Expected asset ID starting with E00, but given asset ID is " + assetId);
		getToken(alertId,sso);
		return;
     }

    // async is a module that allows a statement to run before the previous statement finishes.
    var async = require('async');
	// oracledb is a module that establishes connection with an Oracle database and allows interaction.
    var oracledb = require('oracledb');

    //dbConfig contains the Oracle database connection information
    var dbConfig = require('./dbconfig.js');

    var doconnect = function(cb) {
        /*
         Connect to the Oracle database using the specified info in dbConfig
         cb: A callback is a function called at the completion of a given task; this prevents any blocking,
         and allows other code to be run in the meantime.
         */
        oracledb.getConnection(
            {
                user          : dbConfig.user,
                password      : dbConfig.password,
                connectString : dbConfig.connectString
            },
            cb);
    };

    var dorelease = function(conn) {
        /*
         Close the connection to the database when everything is finished.
         This should always be done if nothing else is being processed!
         If there is an error closing the connection, print and log the error.
         */
        conn.close(function (err) {
            if (err)
                writeToLog(err.message);
        });
    };

    var doinsert = function (conn, cb) {
        /*
         Insert the necessary information into the staging area.
         If there is an error inserting the data, print and log the error message.
         Also automatically commit the database upon successful insertion into the database.
         */
        conn.execute(
            "INSERT INTO " + tableName + "(ALERTID, ASSETID, SITEID, ALERTTYPE, STATUSTYPE, TIMESTAMP, COMMENTS) " +
                "VALUES (:alert_id, :asset_id, :site_id, :alert_type, :status_type, :time_stamp, :comments)",
            [alertId, assetId, siteId, alertType, statusType, timeStamp, comments[0]],  // Bind values
            { autoCommit: true},  // Override the default non-autocommit behavior
            function(err, result)
            {
                if (err) {
                    return cb(err, conn);
                } else {
                    writeToLog("INSERTED ALERTID:" + alertId);
                    return cb(null, conn);
                }
            });
    };

    var updateAlert = function (conn, cb) {
        /*
         Check and see if the alertId already exists in the staging area.
         If it does, update the statusType to the new statusType and update the comments to "oldComments. newStatusType - newComments"
		 If it does not, update the log with an error message.
         */
        
		// Converts the comment array to a string
        var newComment = commentsWithType.toString();

        conn.execute(
            "UPDATE " + tableName + " SET STATUSTYPE = :statusType, COMMENTS = :newComment WHERE ALERTID = :alertId",
            [statusType, newComment, alertId],
            { autoCommit: true},  // Override the default non-autocommit behavior
            function(err, result)
            {
                if (err) {
                    return cb(err, conn);
                } else {
                    if ( result.rowsAffected > 0) {
						// Update the log with a success message
                        writeToLog("UPDATED ALERTID:" + alertId + ". Set STATUSTYPE to " + statusType + " and COMMENTS to " + newComment);
                    }
                    else {
						// Update the log with an error message.
                        writeToLog("An alert with id " + alertId + " does not currently exist in the staging table, but " +
                            "an update was attempted.");
                    }
                    return cb(null, conn);
                }
            });
    };

    //If the statusType says to initiate an alert, parse and send an insert statement to the staging area.
    if (statusType == "Initiate") {
        async.waterfall(
            [
                doconnect,
                doinsert
            ],
            function (err, conn) {
                if (err) {
                    writeToLog("(ALERTID=" + alertId + ") " + err.message);
                }
                if (conn) {
                    dorelease(conn);
                }
            });
    }

    //If the statusType is comment, dont update or attempt to insert anything.
    else if (statusType == "Comment") {
        //do nothing.
    }

    //If the statusType is anything other than "initiate" or "comment", check and see if the alertId already exists in the staging area.
    //If it does, update the comments to: oldStatus. oldComments. newStatus. newComments
    else{
        async.waterfall(
            [
                doconnect,
                updateAlert
            ],
            function (err, conn) {
                if (err) {
                    writeToLog("(ALERTID=" + alertId + ") " + err.message);
                }
                if (conn) {
                    dorelease(conn);
                }
            });
    }
	
}


/*
	Creates a token that will be used to pass into an API request, required to access API. 
*/
//gets a token based on the alertId from Json message
//sso: sso that will be passes in request to eAndon APIs
function getToken(alertId,sso){
	//Verifies valid function parameters 
	try{
		if (alertId == "") throw "There is no alert i.d";
		if (sso == "") throw "There is no sso";
	}	
	catch(err){
		console.error("Error:", err.messgae);
	}
	 
	//Uses request module to make an 'http' calls required for API's
	var request = require("request");

	//generates a POST request with the authorization token 
	var options = { method: 'POST',
		url: authtoken,
	  headers: 
	   { 'postman-token': postmantoken,
		 'cache-control': cachecontrol,
		 authorization: 'Basic ' + authorization,
		 'content-type': contenttype},
	  form: { grant_type: granttype} };

	request(options, function (error, response, body) {
	  if (error) throw new Error(error);
	  getComment("Bearer " + JSON.parse(body)['access_token'],alertId,sso);

	});

}

/*
	Updates, in eAndon, the comments of an alert based on the alertId from the websocket and 
*/
function getComment(token,alertId,sso){
	//Verifies valid function parameters 
	try{
		if (token == "") throw "No token";
		if (alertId == "") throw "No alert i.d";
		if (sso == "") throw "No sso";
	}	
	catch(err){
		console.error("Error:", err.messgae);
	}
	//Uses request module to make an 'http' calls required for API's
	var request = require("request");
	//generates a PUT request with the authorization token 
	var options = { method: 'PUT',
	 url: commenturl+alertId+'/comment', 
	 
	  headers: 
	   { 'postman-token': postmantokencomment,
		 'cache-control': cachecontrolcomment,
		 authorization: token,
		 'content-type':  contenttypecomment},
	  body: 
	   { comment: invalidAssetError,
		 sso: sso },
	  json: true };

	request(options, function (error, response, body) {
	  if (error) throw new Error(error);

	  console.log(body);
	});

}

//calls the connect() function 
connect();

