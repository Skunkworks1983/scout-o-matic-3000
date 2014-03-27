var dbm = require("db-migrate");
var type = dbm.dataType;

exports.up = function(db, next) {
    db.createTable("fouls", {
        "id": { "type": "int", "primaryKey": true, "autoIncrement": true },
        "comment_id": "int",
        "text": "string"
    }, next);
};

exports.down = function(db, next) {
    db.dropTable("actions", next);
};
