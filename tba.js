var request = require("request");
var fs = require("fs");

var folder = "event_data";

var events = module.exports.events = {};

var tba = module.exports.tba = function(endpoint, callback) {
    request.get({
        "url": "http://www.thebluealliance.com/api/v2" + endpoint,
        "headers": {
            "X-TBA-App-Id": "1983:scout-o-matic-3000:v3" // ur dumb blu alliance
        }
    }, function(err, res, body) {
        var data = (err == null) ? JSON.parse(body) : null;
        if (err == null && data == null) err = new Error("TBA returned null");
        return callback(err, data);
    });
};

var getMatchesData = function(eventId, callback) {
    tba("/event/" + eventId + "/matches", callback);
};

var makeTheDirAlready = function(dirname, callback) {
    fs.stat(dirname, function(errTheImportantOne, stat) {
        if (errTheImportantOne) {
            if (errTheImportantOne.code === "ENOENT") {
                fs.mkdir("./" + dirname, function(err) {
                    return callback(err);
                });
            } else {
                return callback(errTheImportantOne);
            }
        } else {
            return callback(null);
        }
    });
};

var cacheData = module.exports.cacheData = function(eventId, callback) {
    if (events[eventId]) return callback(null);
    console.log("attempting to cache " + eventId);
    getMatchesData(eventId, function(err, data) {
        console.log("got data for " + eventId);
        events[eventId] = data; // do this early
        if (err) return callback(err);
        makeTheDirAlready("./" + folder, function(err) {
            if (err) return callback(err);
            fs.writeFile("./" + folder + "/" + eventId + ".json", JSON.stringify(data), "utf-8", function(err) {
                if (err) return callback(err);
                console.log("cached " + eventId + " to " + folder + "/" + eventId + ".json");
                return callback(null);
            });
        });
    });
};

var jsonMatch = /(.*?)\.json/;
var loadCache = module.exports.loadCache = function(callback) {
    makeTheDirAlready("./" + folder, function(err) {
        if (err) return callback(err);
        fs.readdir("./" + folder, function(err, files) {
            if (err) return callback(err);

            files.filter(function(file) {
                test = jsonMatch.exec(file);
                return (test != null && test[1] + ".json" === file);
            });
            var count = 0;
            var length = files.length;
            if (length === 0) return callback(null);

            for (var i = 0; i < length; i++) {
                var file = files[i];
                var eventId = jsonMatch.exec(file)[1];
                fs.readFile("./" + folder + "/" + file, "utf-8", function(err, data) {
                    if (err) return callback(err);
                    events[eventId] = JSON.parse(data); // if this fails you're dumb something bigger is wrong
                    console.log(file + " loaded from cache");
                    if (++count === length) {
                        return callback(null);
                    }
                });
            }
        });
    });
};
