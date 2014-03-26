module.exports = function(grunt) {
    grunt.initConfig({
        "pkg": grunt.file.readJSON("package.json"),

        "jshint": {
            "options": {
                "eqnull": true,
                "expr": true
            },
            "front": {
                "src": ["scout-ui/js/*.js"]
            },
            "back": {
                "src": ["scout.js", "tba.js"]
            }
        },

        "clean": ["scout-ui/minified"],

        "useminPrepare": {
            "html": "scout-ui/index.html",
            "options": {
                "dest": "scout-ui/minified"
            }
        },
        "usemin": {
            "html": "scout-ui/minified/index.html"
        },

        "copy": {
            "index": {
                "src": "scout-ui/index.html",
                "dest": "scout-ui/minified/index.html"
            }
        },


        "htmlmin": {
            "index": {
                "options": {
                    "removeComments": true,
                    "collapseWhitespace": true
                },
                "files": {
                    "scout-ui/minified/index.html": "scout-ui/minified/index.html"
                }
            }
        }
    });

    grunt.loadNpmTasks("grunt-usemin");
    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-contrib-uglify");
    grunt.loadNpmTasks("grunt-contrib-htmlmin");
    grunt.loadNpmTasks("grunt-contrib-cssmin");
    grunt.loadNpmTasks("grunt-contrib-concat");
    grunt.loadNpmTasks("grunt-contrib-copy");
    grunt.loadNpmTasks("grunt-contrib-clean");

    grunt.registerTask("default", ["jshint"]);
    grunt.registerTask("deploy", ["useminPrepare",
                                  "concat:generated",
                                  "uglify:generated",
                                  "cssmin:generated",
                                  "copy:index",
                                  "usemin",
                                  "htmlmin:index"]);
};
