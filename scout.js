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
			"X-TBA-App-Id": "1983:scout-o-matic-3000:v2"
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
	var scoutId = parseInt(req.query.number, 10) - 1;
	var eventId = req.query.event_id;
	if (scoutId == NaN || eventId == null) {
		res.jsonp(400, {"error": "missing number or event_id"});
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
					"matchNumber": match.match_number,
					"robotNumber": team.substr(3),
					"color": color
				});
			});
			res.jsonp(scoutInfo);
		};
		if (cachedTBAData[eventId] == null) {
			tba("/event/details", { "event": eventId }, function(eventData) {
				if (eventData == null) {
					res.jsonp(400, {"error": "TBA returned null"});
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
	res.jsonp(req.body);
});

var app = express();
app.configure(function() {
	app.use("/", express.static(__dirname + "/freezing-octo-wallhack"));
	app.use("/api", apiServer);
});

l("listening on 80");
app.listen(80);