var express = require("express");
var pg = require("pg").native;
var async = require("async");

var whatEventIsHappeningRightNow = "2014waahs";
var whatEventIsHappeningRightNowName = "";

var cache = require("./tba.js");

var l = function() { console.log.apply(console, arguments); };
var jsonParser = function(req, res, next) {
	if (Object.keys(req.body) !== 0) {
		for (var prop in req.body) {
			if (req.body.hasOwnProperty(prop)) {
				req.body[prop] = JSON.parse(req.body[prop]);
			}
		}
	}
	next();
};

var cors = function(req, res, next) {
	res.header("Access-Control-Allow-Origin", "*");
	res.header("Access-Control-Allow-Headers", "X-Requested-With");
	next();
};


var connectionString = process.env.DATABASE_URL || "postgres://test:12345@localhost/actions"; // nice try
var db = new pg.Client(connectionString);

var apiServer = express();

apiServer.configure(function() {
	apiServer.use(cors);
	apiServer.use(express.logger("dev"));
	apiServer.use(express.bodyParser());
	apiServer.use(jsonParser);
	apiServer.use(express.errorHandler());
});

apiServer.get("/register", function(req, res) {
	var scoutId = parseInt(req.query.scout_id, 10) - 1;
	var eventId = req.query.event_id;

	if (isNaN(scoutId) || eventId == null) {
		res.jsonp(400, {"error": "missing number or event_id"});
	} else {
		cache.cacheData(eventId, function(err, cachedData) { // grab data in case cache fails
			if (err) return res.jsonp({"error": err});
			var matchData = cachedData;
			var scoutInfo = [];
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
					"comp_level": match.comp_level,
					"match_number": match.match_number,
					"set_number": match.set_number,
					"key": match.key,
					"sort_number": ((match.match_number < 10) ? "0" + match.match_number : match.match_number) + "" + match.set_number,
					"team_number": parseInt(team.substr(3), 10),
					"color": color
				});
			});
			res.jsonp(scoutInfo);
		});
	}
});

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

apiServer.post("/match", function(req, res) {
	var data = req.body;
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
	console.log("Got " + databaseArray.length + " actions from scout #" + data.scout_number);
	var statement = "INSERT INTO actions (action, value, x, y, time, event_id, team_number, match_number, scout_number, scout_name) VALUES ($1, $2, $3, $4, to_timestamp($5), $6, $7, $8, $9, $10)";
	async.each(databaseArray, function(thing, callback) {
		db.query(statement, thing, function(err, result) {
			if (err) console.log(err);
			callback(err);
		});
	}, function(err) {
		res.jsonp({"error": err});
	});
});

apiServer.delete("/match", function(req, res) {
	if (req.query.id && typeof req.query.id == "string" && req.query.id.length > 0) {
		var statement = "DELETE FROM actions WHERE (id) = ($1)";
		var values = [parseInt(req.query.id, 10)];
		db.query(statement, values, function(err, result) {
			if (err) console.log(err);
			res.jsonp({"error": err});
		});
	} else {
		res.jsonp(400, {"error": "bad request"});
	}
});

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
				if (err) console.log(err);
				res.jsonp({"error": err});
			});
		} else {
			res.jsonp(400, {"error": "bad request"});
		}
	} else {
		res.jsonp(400, {"error": "bad request"});
	}
});

var app = express();

var serveDir = __dirname + "/scout-ui" + (process.env.NODE_ENV === "production" ? "/minified" : "");
app.configure(function() {
	app.use("/", express.static(serveDir));
	app.use("/img", express.static(__dirname + "/scout-ui/img")); // hacks for minification
	app.use("/api", apiServer);
	app.use("/hacks", function(req, res, next) {
		res.type("text/javascript");
		res.send("var eventId=\"" + whatEventIsHappeningRightNow + "\";var eventName=\"" + whatEventIsHappeningRightNowName + "\";"); // oh the hacks
	});
});

var rebuildPivot = function(callback) {
	var columnStatement = "select distinct action from actions order by action";
	var prePivotStatement = "select \\'Match \\' || match_number || \\', Team \\' || team_number as rowid, action as category, count(action) as value from actions group by match_number, team_number, action order by match_number, team_number, action";
	db.query(columnStatement, [], function(err, result) {
		if (err) callback(err);
		var deleteStatement = "drop table pivot_thing";
		var pivotStatement = "select * from crosstab('" + prePivotStatement + ";') as ct(match_team text, " + result.rows.map(function(x) { return x.action; }).join(" bigint, ") + " bigint)";
		var createStatement = "create table pivot_thing (match_team text, " + result.rows.map(function(x) { return x.action; }).join(" bigint, ") + " bigint)";
		db.query(deleteStatement + "; " + createStatement, [], function(err, otherResult) {
			console.log(err);
			if (err) callback(err);
			db.query(pivotStatement, [], function(err, thirdResult) {
				console.log(err);
				if (err) callback(err);
				console.log(thirdResult.rows);
			});
		});
	});
};

var port = parseInt(process.env.PORT, 10) || 8080;
l("connecting to db");
db.connect(function(err) {
	if (err) throw err;
	l("getting event name");
	cache.tba("/event/" + whatEventIsHappeningRightNow, function(err, res) {
		if (err) throw err;
		whatEventIsHappeningRightNowName = res.short_name;
		l("loading data cache");
		cache.loadCache(function(err) {
			if (err) throw err;
			l("listening on " + port);
			l("serving " + serveDir);
			app.listen(port);
		});
	});
});
