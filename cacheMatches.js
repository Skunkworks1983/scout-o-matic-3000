var request = require("request");
var qs = require("querystring");
var fs = require("fs");

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
            cb(new Error("TBA returned null for " + eventId));
        } else {
            tba("/match/details", { "matches": eventData.matches.join(",") }, function(matchData) {
                cachedTBAData[eventId] = matchData;
                cb(matchData);
            });
        }
    });
};

var events = process.argv.slice(2);
if (events.length === 0) throw "Need more args";
events.forEach(function(event) {
    getData(event, function(data) {
        fs.writeFile("event_data/" + event + ".json", JSON.stringify(data), "utf-8", function(err) {
            if (err) console.log(err);
            console.log("finished " + event + " to event_data/" + event + ".json");
        });
    });
});
