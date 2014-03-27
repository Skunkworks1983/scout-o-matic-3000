var dbm = require("db-migrate");
var type = dbm.dataType;

exports.up = function(db, next) {
    db.createTable("fouls", {
        "foul_id": { "type": "int", "primaryKey": true, "autoIncrement": true },
        "event_id": "string",
        "team_number": "int",
        "match_number": "int",
        "scout_number": "int",
        "foul": "string"
    }, next);
};

exports.down = function(db, next) {
    db.dropTable("fouls", next);
};
