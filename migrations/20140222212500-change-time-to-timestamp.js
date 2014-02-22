var dbm = require("db-migrate");
var type = dbm.dataType;

exports.up = function(db, next) {
	db.removeColumn("actions", "time", function(err) {
		if (err) next(err);
		db.addColumn("actions", "time", {
			"type": "timestamp"
		}, next);
	});
};

exports.down = function(db, next) {
	db.removeColumn("actions", "time", function(err) {
		if (err) next(err);
		db.addColumn("actions", "time", {
			"type": "int"
		}, next);
	});
};
