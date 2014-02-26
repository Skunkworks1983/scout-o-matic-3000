var express = require("express");
var pg = require("pg").native;

var whatEventIsHappeningRightNow = "2013wase";

var cache = require("./tba.js");

var l = function() { console.log.apply(console, arguments) };

var connectionString = process.env.DATABASE_URL || "postgres://test:12345@localhost/actions";
var db = new pg.Client(connectionString);

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
		cache.cacheData(eventId, function(err) {
			if (err) console.log(err);
			matchData = cache.events[eventId];
			scoutInfo = [];
			var teamIndex = scoutId;
			if ([0, 1, 2, 3, 4, 5].indexOf(teamIndex) === -1) {
				teamIndex = 1;
			}
			var color = ([0, 1, 2].indexOf(teamIndex) === -1) ? "blue" : "red";
			if (color === "blue") teamIndex -= 3;
			console.log("scout #" + (scoutId + 1) + " registered to be " + color + "[" + teamIndex + "]");
			matchData.forEach(function(match) {
				var team = match.alliances[color].teams[teamIndex];
				scoutInfo.push({
					"match_number": match.match_number,
					"team_number": parseInt(team.substr(3), 10),
					"color": color
				});
			});
			res.jsonp(scoutInfo);
		});
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
	app.use("/hacks", function(req, res, next) {
		res.type("text/javascript");
		res.send("var eventId = \"" + whatEventIsHappeningRightNow + "\";\n");
	});
});

var port = parseInt(process.env.PORT, 10) || 8080;
db.connect(function(err) {
	if (err) throw err;
	cache.loadCache(function(err) {
		if (err) throw err;
		l("listening on " + port);
		app.listen(port);
	});
});
