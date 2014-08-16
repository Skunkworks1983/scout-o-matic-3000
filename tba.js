var request = require("request");
var fs = require("fs");
var async = require("async");

/**
 * This object is where all of the event data is cached to.
 * The various helper functions are attached here too.
 * @module events
 * 
var events = module.exports.events = {};

/** 
 * The folder in which to cache TBA (The Blue Alliance) data. 
 * @global
 */
var folder = "event_data";

/**
 * Callback for TBA calls
 * @callback tba_cb
 * @param err - The error, if any (`null` if no error).
 * @param data - The data returned from TBA, in JSON form.
 */

/**
 * Make a raw request to TBA.
 * @param endpoint - The endpoint, with all parameters (ex: "/event/2014wache/matches").
 * @param {tba_cb} callback - The callback.
 */
var tba = module.exports.tba = function(endpoint, callback) {
    // get raw data from TBA...
    request.get({
        "url": "http://www.thebluealliance.com/api/v2" + endpoint,
        "headers": {
            "X-TBA-App-Id": "1983:scout-o-matic-3000:v3" // ur dumb blu alliance
        }
    }, function(err, res, body) {
        // ...and parse it into JSON
        if (err == null) {
            var data = JSON.parse(body);
            if (data == null) {
                return callback(new Error("TBA returned null"), null);
            } else {
                return callback(null, data);
            }
        } else {
            return callback(err, null)
        }
    });
};

/**
 * Get all of the matches for a specific event.
 * @param eventId - The identification string of the event (ex: "2014wache").
 * @param {tba_cb} callback - The callback.
 */
var getMatchesData = function(eventId, callback) {
    // simple wrapper
    tba("/event/" + eventId + "/matches", callback);
};

/**
 * Callback after creating/checking the directory.
 * @callback makeTheDirAlready_cb
 * @param err - The error, if any (`null` if no error).
 */
 
/**
 * Create a directory inside the root directory, if it doesn't exist.
 * @param dirname - The name of the directory to create.
 * @param {makeTheDirAlready_cb} callback - The callback.
 */
var makeTheDirAlready = function(dirname, callback) {
    // try to check if the dir exists
    fs.stat(dirname, function(errTheImportantOne, stat) {
        // if there is an error...
        if (errTheImportantOne) {
            // ...and the error is "Error, does not exist (ENOENT)"...
            if (errTheImportantOne.code === "ENOENT") {
                // create the directory
                console.log("attempting to create " + dirname);
                // check for directory creation errors in callback
                fs.mkdir("./" + dirname, callback);
            } else {
                // otherwise return the error
                return callback(errTheImportantOne);
            }
        } else {
            // the directory already exists
            return callback(null);
        }
    });
};

/**
 * Get and cache all the matches from an event.
 * Data is returned in the callback.
 * @param eventId - The identification string of the event (ex: "2014wache").
 * @param {tba_cb} callback - The callback.
 */
var cacheData = module.exports.cacheData = function(eventId, callback) {
    // If we already have the data cached in memory, just return it
    if (events[eventId]) {
        return callback(null, events[eventId]);
    }
    console.log("attempting to cache " + eventId);
    // Get the match data
    getMatchesData(eventId, function(err, data) {
        if (err) return callback(err);
        console.log("got data for " + eventId);
        // Attach the data to `events` so we can get it faster (See line 98)
        events[eventId] = data;
        // Create the directory for cached data if it does not exist
        makeTheDirAlready("./" + folder, function(err) {
            if (err) return callback(err);
            // Write the data to a file
            fs.writeFile("./" + folder + "/" + eventId + ".json", JSON.stringify(data), "utf-8", function(err) {
                if (err) return callback(err);
                console.log("cached " + eventId + " to " + folder + "/" + eventId + ".json");
                // Finally, return the data
                return callback(null, data);
            });
        });
    });
};

/**
 * A regular expression to match ".json" files.
 * @global
 */
var jsonMatch = /(.*?)\.json/;

/**
 * Called after loading the cache.
 * @callback loadCache_cb
 * @param err - The error, if any (`null` if no error).
 */

/**
 * Load all cache files into memory for faster access.
 * Call this before everything else.
 * @param {loadCache_cb} - The callback.
 */
var loadCache = module.exports.loadCache = function(callback) {
    // Make sure the directory is there, creating it if necessary
    makeTheDirAlready("./" + folder, function(err) {
        if (err) return callback(err);
        // Read all files in the directory
        fs.readdir("./" + folder, function(err, files) {
            if (err) return callback(err);

            // Filter out non-json files
            files.filter(function(file) {
                var test = jsonMatch.exec(file);
                return (test != null && (test[1] + ".json") === file);
            });

            // If we have no files, return early
            var length = files.length;
            if (length === 0) return callback(null);

            // Otherwise, iterate over each of them...
            async.each(files, function(file, cb) {
                var eventId = jsonMatch.exec(file)[1];
                // ..read them...
                fs.readFile("./" + folder + "/" + file, "utf-8", function(err, data) {
                    if (err) return cb(err);
                    // ...and load them into memory
                    events[eventId] = JSON.parse(data);
                    console.log(file + " loaded from cache");
                    cb(null); // async callback
                });
            }, callback);
        });
    });
};
