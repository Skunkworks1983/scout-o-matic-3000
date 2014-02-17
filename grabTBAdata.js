var sqlite = require("sqlite3").verbose();
var db = new sqlite.Database("scout.sqlite");
var express = require("express");
var request = require("request");
var qs = require("querystring");

var cachedTBAData = {};

var tba = function(endpoint, options, callback) {
    request.get({
        "url": "http://www.thebluealliance.com/api/v1" + endpoint + "?" + qs.stringify(options),
        "headers": {
            "X-TBA-App-Id": "1983:scout-o-matic-3000:v2" // sigh
        }
    }, function(err, res, body) {
        if (err) throw err;
        callback(JSON.parse(body));
    });
}

var getData = function(eventId, cb) {
    tba("/event/details", { "event": eventId }, function(eventData) {
        if (eventData == null) {
            res.jsonp(400, { "error": "TBA returned null for " + eventId });
        } else {
            tba("/match/details", { "matches": eventData.matches.join(",") }, function(matchData) {
                cachedTBAData[eventId] = matchData;
                cb(matchData);
            });
        }
    });
};

getData("2013wase", function(data) {
    console.log(JSON.stringify(data));
});