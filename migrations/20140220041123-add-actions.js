var dbm = require("db-migrate");
var type = dbm.dataType;

exports.up = function(db, next) {
	db.createTable("actions", {
		"id": { "type": "int", "primaryKey": true, "autoIncrement": true },
		"action": "string",
		"value": "string",
		"x": "int",
		"y": "int",
		"time": "int",
		"event_id": "string",
		"team_number": "int",
		"match_number": "int",
		"scout_number": "int",
		"scout_name": "string"
	}, next);
};

exports.down = function(db, next) {
	db.dropTable("actions", next);
};
