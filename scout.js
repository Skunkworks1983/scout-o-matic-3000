var express = require("express");
var pg = require("pg").native;
var async = require("async");

/**
 * Put the event id here (ex: "2014wache").
 * @global
 * @constant
 */
var whatEventIsHappeningRightNow = "2014new";

/**
 * The name of the event will be populated here later.
 * @global
 * @constant
 */
var whatEventIsHappeningRightNowName = "";

/**
 * All match data comes out of the cache.
 * @global
 */
var cache = require("./tba.js");

/**
 * This is a shortcut to console.log.
 * use `l("info to log")` instead of `console.log("info to log")`.
 * @param {...*} anything - Log any number of any things
 * @global
 * @alias console.log
 */
var l = function() { console.log.apply(console, arguments); };

/**
 * Middleware to parse the incoming stringified JSON.
 * @param req - The Request object from express.js.
 * @param res - The Response object from express.js.
 * @param next - The callback which signals that the middleware has processed the request.
 */
var jsonParser = function(req, res, next) {
    // If there is data in the body of the response
    if (Object.keys(req.body) !== 0) {
        // Loop over the stringified JSON properties...
        for (var prop in req.body) {
            if (req.body.hasOwnProperty(prop)) {
                // And re-attach them as regular JSON objects
                req.body[prop] = JSON.parse(req.body[prop]);
            }
        }
    }
    // Then, tell express.js that we're finished
    next();
};

/**
 * Middleware to allow llow Cross-Origin Resource Sharing.
 * @link http://en.wikipedia.org/wiki/Cross-origin_resource_sharing
 * @param req - The Request object from express.js.
 * @param res - The Response object from express.js.
 * @param next - The callback which signals that the middleware has processed the request.
 */
var cors = function(req, res, next) {
    // Set the magic headers that allow CORS
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    // After that, we're done
    next();
};

/**
 * The URL of the database.
 * @global
 * @constant
 */
var connectionString = process.env.DATABASE_URL || "postgres://test:12345@localhost/actions";

/**
 * The database object.
 * @global
 */
var db = new pg.Client(connectionString);

/**
 * The API server object
 * @global
 */
var apiServer = express();

// Set up middleware
// Requests pass through middleware in order, like a waterfall
apiServer.configure(function() {
    apiServer.use(cors); // Allow CORS
    apiServer.use(express.logger("dev")); // log everything
    apiServer.use(express.bodyParser()); // Parse basic JSON data
    apiServer.use(jsonParser); // Parse nested JSON data
    apiServer.use(express.errorHandler()); // Handle errors
});

// The endpoint for when a scout first registers with the server
apiServer.get("/register", function(req, res) {
    // Get the scout ID
    var scoutId = parseInt(req.query.scout_id, 10) - 1;
    // And the event that they're at
    var eventId = req.query.event_id;
    
    if (isNaN(scoutId) || eventId == null) {
        res.jsonp(400, {"error": "missing number or event_id"});
    } else {
        // Get the data from the cache
        cache.cacheData(eventId, function(err, cachedData) {
            if (err) return res.jsonp({"error": err});
            var matchData = cachedData;
            var matches = [];
            var teamIndex = scoutId;
            // Make sure scoutId is valid
            if ([0, 1, 2, 3, 4, 5].indexOf(teamIndex) === -1) {
                teamIndex = 0;
            }
            // Set the color
            var color = ([0, 1, 2].indexOf(teamIndex) === -1) ? "blue" : "red";
            // Teams 4, 5, and 6 are blue
            if (color === "blue") teamIndex -= 3;
            l("scout #" + (scoutId + 1) + " registered to be " + color + "[" + teamIndex + "]");
            // Loop over TBA data
            matchData.forEach(function(match) {
                var team = match.alliances[color].teams[teamIndex];
                // 0-pad the match number for sorting later
                var sortNumber = "" + match.match_number;
                while (sortNumber.length < 3) {
                    sortNumber = "0" + sortNumber;
                }
                // Add the match to the list
                matches.push({
                    "comp_level": match.comp_level,
                    "match_number": match.match_number,
                    "set_number": match.set_number,
                    "key": match.key,
                    "sort_number": sortNumber,
                    "team_number": parseInt(team.substr(3), 10),
                    "color": color
                });
            });
            // return the matches to the scout
            res.jsonp(matches);
        });
    }
});

/**
 * Schema for the CRUD for the three QA tables.
 * The key is the name of the table.
 * The value is the array of columns in the table.
 * The last column is the column to be "searched" for when reading.
 * @global
 * @constant
 */
var qaSchema = {
    "tags": ["comment_id", "text"],
    "fouls": ["event_id", "team_number", "match_number", "scout_number", "foul"],
    "comments": ["event_id", "team_number", "match_number", "scout_number", "comment_id", "comment"],
};

// loop over the schema
Object.keys(qaSchema).forEach(function(table) {
    // Get all the columns in the table
    var cols = qaSchema[table];
    var selectIndex = 1, insertIndex = 1;
    // Create the SELECT statement
    var selectStatement = "select * from " + table + " where " + cols.slice(0, cols.length - 1).map(function(col) {
        return col + " = $" + (selectIndex++);
    }).join(" AND ") + " order by id";
    // Create the INSERT statement
    var insertStatement = "insert into " + table + " (" + cols.join(", ") + ") values (" + cols.map(function(col) {
        return "$" + (insertIndex++);
    }).join(", ") + ")";
    // Create the DELETE statement
    var deleteStatement = "delete from " + table + " where id = $1";
    l("C ", insertStatement);
    l("R ", selectStatement);
    l("U ", insertStatement);
    l("D ", deleteStatement);

    // R - Read (get)
    apiServer.get("/" + table, function(req, res) {
        // Get al
        var values = cols.slice(0, cols.length - 1).map(function(col) {
            return req.query[col];
        });
        db.query(selectStatement, values, function(err, result) {
            if (err) {
                res.jsonp(err);
            } else {
                res.jsonp(result.rows);
            }
        });
    });

    // C - Create (post)
    apiServer.post("/" + table, function(req, res) {
        var data = req.body;
        var keys = Object.keys(data);
        if (keys.length === 0) {
            data = req.query;
            keys = Object.keys(data);
        }
        var values = cols.map(function(col) {
            return data[col];
        });
        db.query(insertStatement, values, function(err, result) {
            if (err) {
                res.jsonp(err);
            } else {
                res.jsonp(result.rows);
            }
        });
    });

    // D - Delete (delete)
    apiServer.delete("/" + table, function(req, res) {
        // Make sure that we don't have a bad request - Otherwise that could be Real Bad
        if (req.query.id && typeof req.query.id === "string" && req.query.id.length > 0) {
            var values = [parseInt(req.query.id, 10)];
            db.query(deleteStatement, values, function(err, result) {
                if (err) console.error(err);
                res.jsonp({"error": err});
            });
        } else {
            res.jsonp(400, {"error": "bad request"});
        }
    });
});

// Show the data for a specific scout from a specific match
// @param scout_number
// @param match_number
apiServer.get("/match", function(req, res) {
    var statement = "SELECT * FROM actions WHERE scout_number = $1 AND match_number = $2 ORDER BY time";
    var values = [req.query.scout_number, req.query.match_number];
    db.query(statement, values, function(err, result) {
        if (err) {
            res.jsonp(err);
        } else {
            res.jsonp(result.rows);
        }
    });
});


/**
 * The callback after rebuilding the pivot table.
 * @callback rebuildPivot_cb
 * @param err - The error, if any (`null` if no error).
 */

/**
 * This wizardry rebuilds the entire pivot table from scratch.
 * Don't question it's brilliance.
 * @param {rebuildPivot_cb} callback - The callback.
 */
var rebuildPivot = function(callback) {
    // God have mercy on your soul
    var columnStatement = "select distinct action from actions order by action";
    var prePivotStatement = "select match_number || \\',\\' || team_number as rowid, action as category, count(action) as value from actions where scout_number != 7 group by match_number, team_number, action order by match_number, team_number, action";
    db.query(columnStatement, [], function(err, result) {
        if (err) callback(err);
        var deleteStatement = "drop table pivot_thing";
        var pivotStatement = "insert into pivot_thing (match_team, " + result.rows.map(function(x) { return x.action; }).join(", ") + ") (select * from crosstab(E'" + prePivotStatement + ";', '" + columnStatement + "') as ct(match_team text, " + result.rows.map(function(x) { return x.action; }).join(" bigint, ") + " bigint))";
        var createStatement = "create table pivot_thing (match_team text, match_number integer, team_number integer, " + result.rows.map(function(x) { return x.action; }).join(" bigint, ") + " bigint)";
        var updateStatement = "update pivot_thing set match_number = split_part(match_team, ',', 1)::integer, team_number = split_part(match_team, ',', 2)::integer";
        db.query(deleteStatement, [], function(err, otherResult) {
            if (err) { console.error(err); callback(err); }
            db.query(createStatement, [], function(err, wowResult) {
                if (err) { console.error(err); callback(err); }
                l("running this monstrosity of a query:", pivotStatement);
                db.query(pivotStatement, [], function(err, thirdResult) {
                    if (err) { console.error(err); callback(err); }
                    db.query(updateStatement, [], function(err, amazingResult) {
                        if (err) { console.error(err); callback(err); }
                        l(amazingResult.rows);
                    });
                });
            });
        });
    });
};

// Recieve data for a single match
apiServer.post("/match", function(req, res) {
    var data = req.body;
    var keys = Object.keys(data);
    if (keys.length === 0) {
        data = req.query;
        keys = Object.keys(data);
    }
    // Prepare data for insertion
    var databaseArray = [];
    data.actions.forEach(function(action) {
        var statementData = [];
        "action|value|x|y|time".split("|").forEach(function(prop) {
            statementData.push(action[prop]);
        });
        "event_id|team_number|match_number|scout_number|scout_name".split("|").forEach(function(prop) {
            statementData.push(data[prop]);
        });
        databaseArray.push(statementData);
    });
    l("Got " + databaseArray.length + " actions from scout #" + data.scout_number);
    var statement = "INSERT INTO actions (action, value, x, y, time, event_id, team_number, match_number, scout_number, scout_name) VALUES ($1, $2, $3, $4, to_timestamp($5), $6, $7, $8, $9, $10)";
    // Run an insert query for every action recieved in parallel
    async.each(databaseArray, function(thing, callback) {
        db.query(statement, thing, function(err, result) {
            if (err) console.error(err);
            callback(err);
        });
    }, function(err) {
        // Once done, rebuild the pivot
        rebuildPivot(function(err) {
            console.error(err);
        });
        res.jsonp({"error": err});
    });
});

// Delete a match's data
// Undocumented and untested
// Used for QA
apiServer.delete("/match", function(req, res) {
    if (req.query.id && typeof req.query.id === "string" && req.query.id.length > 0) {
        var statement = "DELETE FROM actions WHERE (id) = ($1)";
        var values = [parseInt(req.query.id, 10)];
        db.query(statement, values, function(err, result) {
            if (err) console.error(err);
            res.jsonp({"error": err});
        });
    } else {
        res.jsonp(400, {"error": "bad request"});
    }
});

// Update a match's data
// Undocumented and untested
// Used for QA
apiServer.put("/match", function(req, res) {
    var expectedProps = "action|value|x|y|time|event_id|team_number|match_number|scout_number|scout_name".split("|");
    var statement = "INSERT INTO actions (action, value, x, y, time, event_id, team_number, match_number, scout_number, scout_name) VALUES ($1, $2, $3, $4, to_timestamp($5), $6, $7, $8, $9, $10)";
    var data = req.body;
    var keys = Object.keys(data);
    if (keys.length === 0) {
        data = req.query;
        keys = Object.keys(data);
    }
    if (keys.length !== 0) {
        var valid = (keys.length === 10) && keys.reduce(function(previous, current, index, array) {
            var test = function(t) {
                return expectedProps.indexOf(t) !== -1;
            };
            if (index === 1) {
                return (test(previous) && test(current));
            } else {
                return previous && test(current);
            }
        });
        if (valid) {
            values = expectedProps.map(function(prop) {
                return data[prop];
            });
            db.query(statement, values, function(err, result) {
                if (err) console.error(err);
                res.jsonp({"error": err});
            });
        } else {
            res.jsonp(400, {"error": "bad request"});
        }
    } else {
        res.jsonp(400, {"error": "bad request"});
    }
});

/**
 * The webserver that serves the UI.
 * @global
 */
var app = express();

/**
 * The directory of the assets used.
 * When on production, use the minified assets.
 * @global
 * @constant
 */
var serveDir = __dirname + "/scout-ui" + (process.env.NODE_ENV === "production" ? "/minified" : "");

// Mount the different routes
app.configure(function() {
    app.use("/", express.static(serveDir)); // Serve the UI on /
    app.use("/img", express.static(__dirname + "/scout-ui/img")); // Not minified (Images)
    app.use("/qa", express.static(__dirname + "/scout-ui/qa")); // Not minified (QA)
    app.use("/api", apiServer); // Mount the API on /api
    app.use("/hacks", function(req, res, next) {
        // Serve the current event to the UI
        res.type("text/javascript");
        // This is pretty hacky (hence, it's mounted on /hacks)
        res.send("var eventId=\"" + whatEventIsHappeningRightNow + "\";var eventName=\"" + whatEventIsHappeningRightNowName + "\";"); // oh the hacks
    });
});

/**
 * The port to listen on (Defaults to 8080)
 * @global
 * @constant
 */
var port = parseInt(process.env.PORT, 10) || 8080;

// The main code starts here
// This is the "main" method, if you will
// The logs comment fairly well
l("connecting to db");
db.connect(function(err) {
    if (err) throw err;
    l("getting event name");
    cache.tba("/event/" + whatEventIsHappeningRightNow, function(err, res) {
        if (err) throw err;
        // Set this value at run-time
        whatEventIsHappeningRightNowName = res.short_name;
        l("loading data cache");
        cache.loadCache(function(err) {
            if (err) throw err;
            l("listening on " + port);
            l("serving " + serveDir); // Minified when on production
            app.listen(port);
        });
    });
});
