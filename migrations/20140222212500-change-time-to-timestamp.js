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
	changeColumnType(db, "actions", "time", "timestamp", next);
};

exports.down = function(db, next) {
	changeColumnType(db, "actions", "time", "int", next);
};
