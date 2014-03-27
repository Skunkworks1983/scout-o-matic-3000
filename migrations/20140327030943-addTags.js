var dbm = require("db-migrate");
var type = dbm.dataType;

exports.up = function(db, callback) {
    db.createTable("fouls", {
        "id": { "type": "int", "primaryKey": true, "autoIncrement": true },
        "comment_id": "int",
        "text": "string"
    }, next);
};

exports.down = function(db, callback) {
    db.dropTable("actions", next);
};
