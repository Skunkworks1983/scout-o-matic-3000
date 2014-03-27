var dbm = require('db-migrate');
var type = dbm.dataType;

exports.up = function(db, next) {
    db.addColumn("comments", "comment_id", {
        "type": "string"
    }, next);
};

exports.down = function(db, next) {
    db.removeColumn("comments", "comment_id", next);
};
