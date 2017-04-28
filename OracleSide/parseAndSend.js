/* Copyright (c) 2015, 2016, Oracle and/or its affiliates. All rights reserved. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NAME
 *   parseAndSend.js
 *
 * DESCRIPTION
 *   Takes a Json file and extracts the necessary information, then connects
 *		to an oracle database table (specified in dbconfig.js) and inserts (if statusType == initiate)
 *		or updates(otherwise) the parsed information.
 *
 *	 Only parse and send data with the alert type of 'Maintenance'.
 *	 If the assetId does not start with 'M00', call the API to send an error message back to eAndon.
 *
 *	 If statusType = 'Initiate', then create and insert the alert to the staging area.
 *		Otherwise, check and make sure the alert ID exists in the database and update
 *		the statusType if it does.
 *
 *   Also maintains a log of all errors and all successful actions.
 *
 * DEPENDENCIES (node_modules must be located in the same directory as this file)
 *	oracledb - node.js/Oracle interaction (needs Python 2.7, C++11 compiler,
 *  Oracle InstantClient 12)
 *	async - Handles multiple processes running at once
 *
 *
 *****************************************************************************/

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
    var invalidAssetError = "";

    var alertId = inJson['alert']['id'];
    var siteId = inJson['alert']['alertDefinition']['locationId'];
    var alertType = inJson['alert']['alertDefinition']['alertType']['name'];
    var statusType = inJson['type'];
    var timeStamp = inJson['timestamp'];

    //Add all comments to an array unless it is a comment generated through this parser
    var comments = [];
    //These get stored in the staging area with the comments to tell when something happened. Entries correspond to comments
    var commentsWithType = [];
    for (var i = 0; i < inJson['alert']['alertComments'].length; i++)
    {
        comment = inJson['alert']['alertComments'][i]['alertComment']
        commentType = inJson['alert']['alertComments'][i]['alertCommentType'];
        if (commentType == "General" || commentType == "Escalate" || commentType == "Pause" || commentType == "Sla") {
            //do nothing. Ignore all of the comments with commentType "general"
        }
        else if (comment != invalidAssetError) {
            comments.push(comment);
            commentsWithType.push(commentType + ":" + comment);
        }
    }

    //Make sure that this get the assetId from the right comment!! Initiate should always be the first
    var assetId = comments[0].substring(0,8);

    //Change the string here if the table name changes
    var tableName = "staging";

    /* Uncomment this on deployment
     if (alertType != 'Maintenance' || commentType == "Escalate" || commentType == "Pause") {
        return;
     }

     // If the assetId does not start with 'M00' return an invalid assetId error back to eAndon and write it to logFile.
     // Note: Only send error if statusType is initiate because an asset ID already exists in the staging area so it doesn't matter
     //         what the comments are.
     // TODO: Add in the handling for the FCO, FMO, Facilities, and WFSC site asset IDs in this if statement below!
     if (!assetId.startsWith('M00') && statusType = "Initiate") {
     //Send error back to eAndon through API

     writeToLog("(ALERTID=" + alertId + ") " + "Invalid asset ID given. Expected asset ID starting with M00, but given asset ID is " + assetId);
     return;
     }
     */


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

var alert = {"type":"Initiate","timestamp":1492051668167,"alert":{"id":28471,"alertDefinition":{"id":7589,"alertType":{"id":42,"name":"Facilities","description":"Facilities","locationId":null,"archived":false,"lastUpdatedDate":1481470409096,"lastUpdatedByUserString":"Andrew Severson","userSubscribed":false},"alertDefinitionSlas":[{"id":10986,"order":1,"numberOfMinutes":30},{"id":10987,"order":2,"numberOfMinutes":60},{"id":10988,"order":3,"numberOfMinutes":120},{"id":10989,"order":4,"numberOfMinutes":240}],"locationId":"008bffa2-549e-4eb1-b5d8-de53fc0b3f00","name":"FCO Manufacturing gases","description":"Flow over max value","qrCode":"5171055f-c94b-4107-b6ff-f0ed21a9b3f1","onlyOneActive":null,"archived":false,"lastUpdatedByUserString":"Lillie Colom","lastUpdatedDate":1490278581458,"hasSlaCoverage":false,"hasStatusCoverage":false},"slaCheckTimestamp":null,"resolveTimestamp":null,"alertSlaComment":0,"status":"Initiated","slaPause":false,"slaPauseDatetime":null,"alertComments":[{"id":32573,"alertComment":"test","alertCommentDate":1492051667896,"alertCommentType":"Initiated","userString":"Lillie Colom","sso":"502053031"}],"initiatedByUserString":"Lillie Colom","acknowledgedByUserString":"","resolvedByUserString":""}}
var commentalert = {"type":"Acknowledged","timestamp":1493330975781,"alert":{"id":28471,"alertDefinition":{"id":9104,"alertType":{"id":204,"name":"FCO TEST","description":"Test Alert","locationId":"f7bfb6ed-5471-4a69-823c-89297c0f2e54","archived":false,"lastUpdatedDate":1491413771155,"lastUpdatedByUserString":"David Vargo","userSubscribed":false},"alertDefinitionSlas":[{"id":18765,"order":1,"numberOfMinutes":30}],"locationId":"22df2712-b55b-4ed3-bd93-a808661ce13c","name":"FCO TEST","description":"Test alert","qrCode":"1eade374-09d8-4ecf-a490-935f3ed354d3","onlyOneActive":null,"archived":false,"lastUpdatedByUserString":"David Vargo","lastUpdatedDate":1491413917423,"hasSlaCoverage":false,"hasStatusCoverage":false},"slaCheckTimestamp":1493321976557,"initiateTimestamp":1493321976557,"acknowledgeTimestamp":1493323393270,"resolveTimestamp":null,"alertSlaCount":1,"status":"Acknowledged","slaPause":false,"slaPauseDatetime":null,"alertComments":[{"id":55754,"alertComment":"another alert through api","alertCommentDate":1493321976565,"alertCommentType":"Initiated","userString":"Kimberley Parnell","sso":"212572107"},{"id":55767,"alertComment":"test acknowledge","alertCommentDate":1493323393274,"alertCommentType":"Acknowledged","userString":"Lillie Colom","sso":"502053031"},{"id":55864,"alertComment":"I am updating the alert with i Kim","alertCommentDate":1493330654967,"alertCommentType":"General","userString":"Lillie Colom","sso":"502053031"},{"id":55865,"alertComment":"test comment 123","alertCommentDate":1493330893850,"alertCommentType":"General","userString":"Lillie Colom","sso":"502053031"},{"id":55866,"alertComment":"test98766","alertCommentDate":1493330975417,"alertCommentType":"General","userString":"Lillie Colom","sso":"502053031"}],"initiatedByUserString":"Kimberley Parnell","acknowledgedByUserString":"Lillie Colom","resolvedByUserString":""}};
var updatealert = {"type":"Acknowledged","timestamp":1492051668167,"alert":{"id":22427,"alertDefinition":{"id":7589,"alertType":{"id":42,"name":"Facilities","description":"Facilities","locationId":null,"archived":false,"lastUpdatedDate":1481470409096,"lastUpdatedByUserString":"Andrew Severson","userSubscribed":false},"alertDefinitionSlas":[{"id":10986,"order":1,"numberOfMinutes":30},{"id":10987,"order":2,"numberOfMinutes":60},{"id":10988,"order":3,"numberOfMinutes":120},{"id":10989,"order":4,"numberOfMinutes":240}],"locationId":"008bffa2-549e-4eb1-b5d8-de53fc0b3f00","name":"FCO Manufacturing gases","description":"Flow over max value","qrCode":"5171055f-c94b-4107-b6ff-f0ed21a9b3f1","onlyOneActive":null,"archived":false,"lastUpdatedByUserString":"Lillie Colom","lastUpdatedDate":1490278581458,"hasSlaCoverage":false,"hasStatusCoverage":false},"slaCheckTimestamp":null,"resolveTimestamp":null,"alertSlaComment":0,"status":"Initiated","slaPause":false,"slaPauseDatetime":null,"alertComments":[{"id":32573,"alertComment":"test update","alertCommentDate":1492051667896,"alertCommentType":"Initiated","userString":"Lillie Colom","sso":"502053031"}],"initiatedByUserString":"Lillie Colom","acknowledgedByUserString":"","resolvedByUserString":""}}
var update2 = {"type":"Resolved","timestamp":1492051668167,"alert":{"id":22427,"alertDefinition":{"id":7589,"alertType":{"id":42,"name":"Facilities","description":"Facilities","locationId":null,"archived":false,"lastUpdatedDate":1481470409096,"lastUpdatedByUserString":"Andrew Severson","userSubscribed":false},"alertDefinitionSlas":[{"id":10986,"order":1,"numberOfMinutes":30},{"id":10987,"order":2,"numberOfMinutes":60},{"id":10988,"order":3,"numberOfMinutes":120},{"id":10989,"order":4,"numberOfMinutes":240}],"locationId":"008bffa2-549e-4eb1-b5d8-de53fc0b3f00","name":"FCO Manufacturing gases","description":"Flow over max value","qrCode":"5171055f-c94b-4107-b6ff-f0ed21a9b3f1","onlyOneActive":null,"archived":false,"lastUpdatedByUserString":"Lillie Colom","lastUpdatedDate":1490278581458,"hasSlaCoverage":false,"hasStatusCoverage":false},"slaCheckTimestamp":null,"resolveTimestamp":null,"alertSlaComment":0,"status":"Initiated","slaPause":false,"slaPauseDatetime":null,"alertComments":[{"id":32573,"alertComment":"error is resolved","alertCommentDate":1492051667896,"alertCommentType":"Initiated","userString":"Lillie Colom","sso":"502053031"}],"initiatedByUserString":"Lillie Colom","acknowledgedByUserString":"","resolvedByUserString":""}}

//Call function with test Json above
parseJson(commentalert)
