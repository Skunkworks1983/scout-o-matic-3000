var dbm = require("db-migrate");
var type = dbm.dataType;

var changeColumnType = function(db, table, column, newtype, next) {
	db.removeColumn(table, column, function(err) {
		if (err) next(err);
		db.addColumn(table, column, {
			"type": newtype
		}, next);
	});
};

exports.up = function(db, next) {
	changeColumnType(db, "actions", "x", "real", function(err) {
		if (err) next(err);
		changeColumnType(db, "actions", "y", "real", next);
	});
};

exports.down = function(db, next) {
	changeColumnType(db, "actions", "x", "int", function(err) {
		if (err) next(err);
		changeColumnType(db, "actions", "y", "int", next);
	});
};
