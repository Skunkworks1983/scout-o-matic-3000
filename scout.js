var express = require("express");
var request = require("request");
var qs = require("querystring");
var pg = require("pg").native;
var fs = require("fs");

var connectionString = process.env.DATABASE_URL || "postgres://test:12345@localhost/actions";
var db = new pg.Client(connectionString);

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
};

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
	for (prop in req.body) { // fix this
		data[prop] = JSON.parse(req.body[prop]);
	}
	databaseArray = [];
	data.actions.forEach(function(action) {
		statementData = [];
		"action|value|x|y|time".split("|").forEach(function(prop) {
			statementData.push(action[prop]);
		});
		"event_id|team_number|match_number|scout_number|scout_name".split("|").forEach(function(prop) {
			statementData.push(data[prop]);
		});
		databaseArray.push(statementData);
	});
	databaseArray.forEach(function(thing) {
		statement = db.query({
			"name": "insertQuery",
			"text": "INSERT INTO actions (action, value, x, y, time, event_id, team_number, match_number, scout_number, scout_name) VALUES ($1, $2, $3, $4, to_timestamp($5), $6, $7, $8, $9, $10)",
			"values": thing
		});
	});
	res.jsonp({"error": null});
});

var app = express();

app.configure(function() {
	// app.use(express.logger("dev"));
	app.use("/", express.static(__dirname + "/freezing-octo-wallhack"));
	app.use("/api", apiServer);
});

var port = parseInt(process.env.PORT, 10) || 8080;
db.connect(function(err) {
	if (err) return console.error("CRAZY SHIT HAPPENED at " + connectionString, err);
	fs.readdir("./event_data", function(err, files) {
		if (err) return console.error("COULDN'T STAT DIR ./event_data", err);
		var count = 0;
		files.forEach(function(file) {
			fs.readFile("./event_data/" + file, "utf-8", function(err, data) {
				if (err) return console.error("COULDN'T READ FILE./event_data/" + file, err);
				cachedTBAData = JSON.parse(data);
				console.log(file + " loaded from cache");
				if (++count === files.length) {
					l("listening on " + port);
					app.listen(port);
				}
			});
		});
	});
});
