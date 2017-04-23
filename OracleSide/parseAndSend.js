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
 *		to an oracle database table (specified in dbconfig.js) and inserts (initiate)
 *		or updates(otherwise) the parsed information.
 *
 *	 Only parse and send data with the alert type of 'Maintenance'.
 *
 *	 If statusType = 'Initiate', then create and insert the alert to the staging area.
 *		Otherwise, check and make sure the alert ID exists in the database and updateCommands
 *		the comments if it does.
 *
 *   Also maintains a log of all errors and all successful actions.	
 *
 * DEPENDENCIES (node_modules must be located in the same directory as this file)
 *	oracledb - node.js/Oracle interaction (needs Python 2.7, C++11 compiler,
 Oracle InstantClient 12)
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
     Take a json file and extract the alertId, alertType, assetId, siteId, comments, and statusType.
     Then connect to a database and:
        If the alertId does not exist in the database and the statusType is 'Initiate', insert it with the fields listed above.
        If the alertId is already in the database and the statusType is not 'Initiate', update the current alertId
            to show the new status followed by the new comments.

     If any error occurs, show the log in the console and write it to the log file. Also log any JSON that comes through
        into the log file.

     alertId : primary key in staging area. Uniquely identifies alerts.
     alertType : specifies what kind of alert is being created.
     assetId : identifies machine that the alert is addressing. This is found by calling the API to the asset model and passing
        it the siteId.
     siteId : the location of the machine.
     comments: anything extra that the user wants to include about the alert.
     statusType: whether the alert is being initiated or updated.
     */

    var alertId = inJson['alert']['id'];
    var alertType = inJson['alert']['alertDefinition']['alertType']['name'];
    var assetId = 'TEST_ASSET_ID';
    var siteId = inJson['alert']['alertDefinition']['locationId'];
    var comments = inJson['alert']['alertComments'][0]['alertComment'];
    var statusType = inJson['type'];
    var timeStamp = inJson['initiateTimestamp'];

    /* Uncomment this on deployment
     if (alertType != 'Maintenance') {
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
            "INSERT INTO staging VALUES (:alert_id, :alert_type, :asset_id, :site_id, :comments)",
            [alertId, alertType, assetId, siteId, comments],  // Bind values
            { autoCommit: true},  // Override the default non-autocommit behavior
            function(err, result)
            {
                if (err) {
                    return cb(err, conn);
                } else {
                    writeToLog("INSERTED ALERT_ID:" + alertId);
                    return cb(null, conn);
                }
            });
    };

    var updateAlert = function (conn, cb) {
        /*
         Check to see if an alert id already exists.
         check and see if the alertId already exists in the staging area.
         If it does, update the comments to: currentStatus. newComments
         */
        var newComments = statusType + ". " + comments;
        conn.execute(
            "UPDATE staging SET comments=:newComments WHERE alert_id = :alertId",
            [newComments, alertId],
            { autoCommit: true},  // Override the default non-autocommit behavior
            function(err, result)
            {
                if (err) {
                    return cb(err, conn);
                } else {
                    if ( result.rowsAffected > 0) {
                        writeToLog("UPDATED ALERT_ID:" + alertId);
                    }
                    else {
                        writeToLog("An alert with id " + alertId + " does not currently exist in the staging table.");
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
                    writeToLog(err.message);
                }
                if (conn) {
                    dorelease(conn);
                }
            });
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
                    writeToLog(err.message);
                }
                if (conn) {
                    dorelease(conn);
                }
            });
    }
}

var alert = {"type":"Initiate","timestamp":1492051668167,"alert":{"id":22426,"alertDefinition":{"id":7589,"alertType":{"id":42,"name":"Facilities","description":"Facilities","locationId":null,"archived":false,"lastUpdatedDate":1481470409096,"lastUpdatedByUserString":"Andrew Severson","userSubscribed":false},"alertDefinitionSlas":[{"id":10986,"order":1,"numberOfMinutes":30},{"id":10987,"order":2,"numberOfMinutes":60},{"id":10988,"order":3,"numberOfMinutes":120},{"id":10989,"order":4,"numberOfMinutes":240}],"locationId":"008bffa2-549e-4eb1-b5d8-de53fc0b3f00","name":"FCO Manufacturing gases","description":"Flow over max value","qrCode":"5171055f-c94b-4107-b6ff-f0ed21a9b3f1","onlyOneActive":null,"archived":false,"lastUpdatedByUserString":"Lillie Colom","lastUpdatedDate":1490278581458,"hasSlaCoverage":false,"hasStatusCoverage":false},"slaCheckTimestamp":null,"resolveTimestamp":null,"alertSlaComment":0,"status":"Initiated","slaPause":false,"slaPauseDatetime":null,"alertComments":[{"id":32573,"alertComment":"test 7","alertCommentDate":1492051667896,"alertCommentType":"Initiated","userString":"Lillie Colom","sso":"502053031"}],"initiatedByUserString":"Lillie Colom","acknowledgedByUserString":"","resolvedByUserString":""}}

var updatealert = {"type":"Acknowledged","timestamp":1492051668167,"alert":{"id":22424,"alertDefinition":{"id":7589,"alertType":{"id":42,"name":"Facilities","description":"Facilities","locationId":null,"archived":false,"lastUpdatedDate":1481470409096,"lastUpdatedByUserString":"Andrew Severson","userSubscribed":false},"alertDefinitionSlas":[{"id":10986,"order":1,"numberOfMinutes":30},{"id":10987,"order":2,"numberOfMinutes":60},{"id":10988,"order":3,"numberOfMinutes":120},{"id":10989,"order":4,"numberOfMinutes":240}],"locationId":"008bffa2-549e-4eb1-b5d8-de53fc0b3f00","name":"FCO Manufacturing gases","description":"Flow over max value","qrCode":"5171055f-c94b-4107-b6ff-f0ed21a9b3f1","onlyOneActive":null,"archived":false,"lastUpdatedByUserString":"Lillie Colom","lastUpdatedDate":1490278581458,"hasSlaCoverage":false,"hasStatusCoverage":false},"slaCheckTimestamp":null,"resolveTimestamp":null,"alertSlaComment":0,"status":"Initiated","slaPause":false,"slaPauseDatetime":null,"alertComments":[{"id":32573,"alertComment":"test 7","alertCommentDate":1492051667896,"alertCommentType":"Initiated","userString":"Lillie Colom","sso":"502053031"}],"initiatedByUserString":"Lillie Colom","acknowledgedByUserString":"","resolvedByUserString":""}}


//Call function with test Json above
parseJson(alert)

