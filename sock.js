
var quote;
function connect() {
  var WebSocket = require('faye-websocket'),
	//establish web socket connection to the endpoint
   ws = new WebSocket.Client('wss://eandon-metadata.run.asv-pr.ice.predix.io/websocketendpoint/websocket', [], {
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
	//Subscribe based on location id 
	//client.subscribe('/websockets/locations/22df2712-b55b-4ed3-bd93-a808661ce13c', function(message) 	
	
	//FMO Site_Id 
	client.subscribe('/websockets/locations/892e99c0-9318-4839-9f71-b1945569f590', function(message) 	
	

	
	{
	
	//parse JSON file ....
    quote = JSON.parse(message.body);
	//console.log(parseJson(quote));	
	}
	)
}
);  
};

connect();
function writeToLog(errMessage) {
    /*
    Append a message to a log file, which will save the date and time at which the action occurred and
        either: an error message that was returned by Oracle or the JSON file that was altered or inserted.
     */

    //fs is required to create/write to the log file
    var fs = require('fs');

    //Create new date object, which stores the current date & time by default
    var dateTime = new Date();

    fs.appendFile('logfile.txt', dateTime + ":\t" + errMessage + "\n", function (err) {
        if (err) throw err;
        console.log("Written to log: " + errMessage);
    });
}

function parseJson (inJson) {
    /*
     Take a json file and extract the alertId, assetId, siteId, alertType, statusType, timeStamp, and comments.
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
     comments: anything extra that the user wants to include about the alert.
     */

    //This is the error message that the parser sends back to eAndon whenever an asset ID is invalid
    var invalidAssetError = "invalid asset id";

    var alertId = inJson['alert']['id'];
    var siteId = inJson['alert']['alertDefinition']['locationId'];
    var alertType = inJson['alert']['alertDefinition']['alertType']['name'];
    var statusType = inJson['type'];
    var timeStamp = inJson['timestamp'];
	var alertDefId = inJson['alert']['alertDefinition']['id'];

    //Add all comments to an array unless it is a comment generated through this parser
    var comments = [];
    //These get stored in the staging area with the comments to tell when something happened. Entries correspond to comments
    var commentsWithType = [];
    for (var i = 0; i < inJson['alert']['alertComments'].length; i++)
    {
        comment = inJson['alert']['alertComments'][i]['alertComment']
        commentType = inJson['alert']['alertComments'][i]['alertCommentType'];
        if (commentType == "General" || commentType == "Escalate" || commentType == "Pause") {
            //do nothing. Ignore all of the comments with commentType "general"
        }
        else if (comment != invalidAssetError) {
            comments.push(comment);
            commentsWithType.push(commentType + ":" + comment);
        }
    }

    //Make sure that this get the assetId from the right comment!! Initiate should always be the first
    var assetId = comments.toString().substring(0,8);

    //Change the string here if the table name changes
    var tableName = "GEPSEAM.GEPS_EAM_MAINTENENCE_WO";

  
     if (alertType != 'Maintenance') {
        return "Not maintenance";
     }
     // If the assetId does not start with 'M00' return an invalid assetId error back to eAndon and write it to logFile.
     // Note: Only send error if statusType is initiate because an asset ID already exists in the staging area so it doesn't matter
     //         what the comments are.
     // TODO: Add in the handling for the FCO, FMO, Facilities, and WFSC site asset IDs in this if statement below!
     if ((!assetId.startsWith('M00')) && (siteId==('ae0cb684-6d22-42df-a7da-572bb1b1875c')) && statusType == "Initiate") {
     //Send error back to eAndon through API
	 
     writeToLog("(ALERTID=" + alertId + ") " + "Invalid asset ID given. Expected asset ID starting with M00, but given asset ID is " + assetId);
		getToken(alertDefId);
	return;
     }
     


    //Database scripting starts here
    var async = require('async');
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
         Else, display how many rows were inserted.
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
         Check to see if an alert id already exists.
         check and see if the alertId already exists in the staging area.
         If it does, update the statusType to the new statusType and update the comments to "oldComments. newStatusType - newComments"
         */
        
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
                        writeToLog("UPDATED ALERTID:" + alertId + ". Set STATUSTYPE to " + statusType + " and COMMENTS to " + newComment);
                    }
                    else {
                        writeToLog("An alert with id " + alertId + " does not currently exist in the staging table, but " +
                            "an update was attempted.");
                    }
                    return cb(null, conn);
                }
            });
    };

    //If the statusType says to initiate an alert, parse and send the alert information to the staging area.
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

    //If the statusType is comment, dont update or attemp to insert anything.
    else if (statusType == "Comment") {
        //do nothing.
    }

    //If the statusType is anything other than "initiate", check and see if the alertId already exists in the staging area.
    //If it does, update the comments to: currentStatus. newComments
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


//get Api

function getToken(alertDefId){
	
	var request = require("request");

	var options = { method: 'POST',
		url: 'https://a99b7fee-a495-4161-89c3-faa83054627d.predix-uaa.run.asv-pr.ice.predix.io/oauth/token',
		
	  headers: 
	   { 'postman-token': 'd305305b-68ca-c5be-6ac6-288f895df88f',
		 'cache-control': 'no-cache',
		 authorization: 'Basic aGVhbHRoY2FyZV9icmlsbGlhbnRfYXBwc19odWJfZWFuZG9uX3Byb2Q6NEZ3NDRSbGV1bVRweHNlOA==',
		 'content-type': 'application/x-www-form-urlencoded' },
	  form: { grant_type: 'client_credentials' } };

	request(options, function (error, response, body) {
	  if (error) throw new Error(error);
	  //console.log(body);
	  getComment("Bearer " + JSON.parse(body)['access_token'],alertDefId);
	  
	  //console.log(parseAccessToken(JSON.parse(body)));
	});

}


function getComment(token,alertDefId){
	var request = require("request");

	var options = { method: 'PUT',
	//url: 'https://eandon-metadata.run.asv-pr.ice.predix.io/api/v1/alerts/28471/comment',
	 url: 'https://eandon-metadata.run.asv-pr.ice.predix.io/api/v1/alerts/'+alertDefId+'/comment',
	  headers: 
	   { 'postman-token': 'cde0dbc5-4fb4-c42e-e8ab-4d17b5a78807',
		 'cache-control': 'no-cache',
		 authorization: token,
		 'content-type': 'application/json' },
	  body: 
	   { comment: invalidAssetError,
		 sso: '502053031' },
	  json: true };

	request(options, function (error, response, body) {
	  if (error) throw new Error(error);

	  //console.log(body);
	});

}


