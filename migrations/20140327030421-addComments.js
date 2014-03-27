var dbm = require("db-migrate");
var type = dbm.dataType;

exports.up = function(db, callback) {
    db.createTable("fouls", {
        "id": { "type": "int", "primaryKey": true, "autoIncrement": true },
        "event_id": "string",
        "team_number": "int",
        "match_number": "int",
        "scout_number": "int",
        "comment": "string"
    }, next);
};

exports.down = function(db, callback) {
    db.dropTable("actions", next);
};