var sqlite = require("sqlite3").verbose();
var db = new sqlite.Database("scout.sqlite");
var express = require("express");
var request = require("request");
var qs = require("querystring");

var cachedTBAData = {};

// var fs = require("fs");
// cachedTBAData["2013wase"] = JSON.parse(fs.readFileSync("./2013wase.json"));

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

var l = function() { console.log.apply(console, arguments) };

var apiServer = express();

apiServer.configure(function() {
	apiServer.use(express.logger("dev"));
	apiServer.use(express.bodyParser());
	apiServer.use(express.errorHandler());
});

apiServer.get("/register", function(req, res) {
	var scoutId = parseInt(req.query.scout_id, 10) - 1;
	var eventId = req.query.event_id;

	if (isNaN(scoutId) || eventId == null) {
		res.jsonp(400, { "error": "missing number or event_id" });
	} else {
		var handleTBAData = function(matchData) {
			scoutInfo = [];
			matchData.forEach(function(match) {
				var team = match.team_keys[scoutId];
				var color = "";
				for (teamColor in match.alliances) {
					if (match.alliances[teamColor].teams.indexOf(team) != -1) {
						color = teamColor;
					}
				}
				scoutInfo.push({
					"match_number": match.match_number,
					"team_number": parseInt(team.substr(3), 10),
					"color": color
				});
			});
			res.jsonp(scoutInfo);
		};
		if (cachedTBAData[eventId] == null) {
			tba("/event/details", { "event": eventId }, function(eventData) {
				if (eventData == null) {
					res.jsonp(400, { "error": "TBA returned null for " + eventId });
				} else {
					tba("/match/details", { "matches": eventData.matches.join(",") }, function(matchData) {
						cachedTBAData[eventId] = matchData;
						handleTBAData(matchData);
					});
				}
			});
		} else {
			handleTBAData(cachedTBAData[eventId]);
		}
	}
});

apiServer.post("/match", function(req, res) {
	var data = {};
	for (prop in req.body) {
		data[prop] = JSON.parse(req.body[prop]);
	}
	var statementString = "INSERT INTO actions (";
	var columns = "action value x y time event_id team_number match_number".split(" ")
	statementString += columns.join(", ");
	statementString += ") VALUES (";
	statementString += columns.map(function(column) {
		return "$" + column;
	}).join(", ");
	statementString += ")";
	statement = db.prepare(statementString);
	databaseArray = [];
	data.actions.forEach(function(action) {
		newAction = {};
		for (prop in action) {
			newAction["$" + prop] = action[prop];
		}
		"event_id team_number match_number".split(" ").forEach(function(prop) {
			newAction["$" + prop] = data[prop];
		});
		databaseArray.push(newAction);
	});
	databaseArray.forEach(function(thing) {
		statement.run(thing);
	});
	res.jsonp({"error": null});
});

var app = express();

app.configure(function() {
	// app.use(express.logger("dev"));
	app.use("/", express.static(__dirname + "/freezing-octo-wallhack"));
	app.use("/api", apiServer);
});

var port = Number(process.env.PORT || 8080);
db.run('CREATE TABLE IF NOT EXISTS "actions" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "event_id" varchar(255), "action" varchar(255), "value" varchar(255), "time" integer, "x" integer, "y" integer, "team_number" integer, "match_number" integer);', function() {
	l("listening on " + port);
	app.listen(port);
});
