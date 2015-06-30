var fs = require("fs"),
    mn3tools = {};

mn3tools.File = function(filename, callback) {
    "use strict";

    this.filename = filename;
    this.parse(callback);

    return this;
};

mn3tools.File.prototype.parse = function(callback) {
    "use strict";

    var file = this;

    // Ensure the file exists.
    fs.exists(file.filename, function(exists) {
        file.exists = exists;
        if (!exists) {
            callback();
        }

        // Open the file.
        fs.open(file.filename, "r", function(err, fd) {
            if (err) {
                callback(err);
            }

            // Check for an _2 file.
            (function(callback) {
                var file2;

                // Don't check for the file if we are already checking for it.
                if (/_2\.mn3$/.test(file.filename)) {
                    callback();
                    return;
                }

                file2 = new mn3tools.File(file.filename.substring(0, file.filename.length - 4) + "_2.mn3", function() {
                    callback(file2);
                });
            }(function(file2) {
                // Get the header.
                var headerStream = fs.createReadStream("", {
                    fd: fd,
                    autoClose: false,
                    start: 0,
                    end: 11
                });

                headerStream.once("readable", function() {
                    var currentFile = 0,
                        currentOffset;

                    if (headerStream.read(4).toString() !== "HOG2") {
                        callback();
                    }
                    file.numFiles = headerStream.read(4).readUInt32LE();
                    file.offset = headerStream.read(4).readUInt32LE();
                    file.entries = [];

                    currentOffset = file.offset;

                    // Get the file entries.
                    (function getEntry() {
                        var entryStream = fs.createReadStream("", {
                            fd: fd,
                            autoClose: false,
                            start: 68 + (currentFile * 48),
                            end: 68 + (currentFile * 48) + 43
                        });

                        entryStream.once("readable", function() {
                            var filename = entryStream.read(36).toString().replace(/\x00.*/, ""),
                                _ = entryStream.read(4),
                                bytes = entryStream.read(4).readUInt32LE(),
                                index, msnStream;

                            file.entries.push({
                                filename: filename,
                                bytes: bytes,
                                offset: currentOffset
                            });

                            currentOffset += bytes;

                            currentFile++;
                            if (currentFile < file.numFiles) {
                                getEntry();
                                return;
                            }

                            // Get the MSN data.
                            for (index = 0; index < file.numFiles; index++) {
                                if (/.*\.msn$/i.test(file.entries[index].filename)) {
                                    break;
                                }
                            }

                            msnStream = fs.createReadStream("", {
                                fd: fd,
                                autoClose: false,
                                start: file.entries[index].offset,
                                end: file.entries[index].offset + file.entries[index].bytes - 1
                            });

                            msnStream.once("readable", function() {
                                file.urls = [];
                                file.levels = [];
                                msnStream.read(file.entries[index].bytes).toString().replace(/[\t ]+/g, " ").replace(/[\r\n]+/g, "\r").split("\r").forEach(function(line) {
                                    var matches = /(^[^ ]+) ?(.*)$/.exec(line);

                                    if (matches) {
                                        switch (matches[1].toLowerCase()) {
                                            case "name":
                                                file.name = matches[2];
                                                break;
                                            case "numlevels":
                                                file.numLevels = +matches[2];
                                                break;
                                            case "url":
                                                file.urls.push(matches[2]);
                                                break;
                                            case "author":
                                                file.author = matches[2];
                                                break;
                                            case "single":
                                                file.singlePlayer = !(/^n/i.test(matches[2]));
                                                break;
                                            case "multi":
                                                file.multiPlayer = !(/^n/i.test(matches[2]));
                                                break;
                                            case "description":
                                                file.description = matches[2];
                                                break;
                                            case "keywords":
                                                matches[2].toLowerCase().split(",").forEach(function(keyword) {
                                                    var goals = /^goals([1-9][0-9]*)$/.exec(keyword);
                                                    if (goals) {
                                                        if (+goals[1] >= 2 && +goals[1] <= 4) {
                                                            file.ctf = true;
                                                            file.teams = +goals[1];
                                                        }
                                                        file.hoard = true;
                                                    } else {
                                                        switch (keyword) {
                                                            case "goalperteam":
                                                                file.ctf = true;
                                                                break;
                                                            case "spec1":
                                                                file.monsterball = true;
                                                                break;
                                                            default:
                                                                file[keyword] = true;
                                                                break;
                                                        }
                                                    }
                                                });
                                                break;
                                            case "level":
                                                if (file2 && file2.levels && file2.levels[file.levels.length]) {
                                                    file.levels.push(file2.levels[file.levels.length]);
                                                } else {
                                                    file.levels.push({});
                                                }
                                                break;
                                            case "briefing":
                                                file.levels[file.levels.length - 1].briefing = matches[2];
                                                break;
                                            case "score":
                                                file.levels[file.levels.length - 1].score = matches[2];
                                                break;
                                            case "mine":
                                                file.levels[file.levels.length - 1].mine = matches[2];
                                                break;
                                            case "intromovie":
                                                file.levels[file.levels.length - 1].introMovie = matches[2];
                                                break;
                                            case "endmovie":
                                                file.levels[file.levels.length - 1].endMovie = matches[2];
                                                break;
                                            case "progress":
                                                file.levels[file.levels.length - 1].progress = matches[2];
                                                break;
                                            case "secret":
                                                file.levels[file.levels.length - 1].secret = +matches[2];
                                                break;
                                            case "endmission":
                                                file.levels[file.levels.length - 1].lastLevel = true;
                                                break;
                                            case "branch":
                                                file.levels[file.levels.length - 1].nextLevel = +matches[2];
                                                break;
                                        }
                                    }
                                });

                                // For each level, find the RDL file and add the name.
                                index = 0;

                                (function(callback) {
                                    (function getLevel() {
                                        var entries = file.entries.filter(function(entry) {
                                            return entry.filename.toLowerCase() === file.levels[index].mine.toLowerCase();
                                        }),
                                            buffer = "",
                                            rdlStream;

                                        function nextLevel() {
                                            index++;
                                            if (index < file.levels.length) {
                                                getLevel();
                                                return;
                                            }
                                            callback();
                                        }

                                        if (entries.length === 0) {
                                            nextLevel();
                                            return;
                                        }

                                        rdlStream = fs.createReadStream("", {
                                            fd: fd,
                                            autoClose: false,
                                            start: entries[0].offset,
                                            end: entries[0].offset + entries[0].bytes - 1
                                        });

                                        rdlStream.on("readable", function() {
                                            var data = rdlStream.read(),
                                                info;

                                            if (data) {
                                                buffer += data.toString();
                                                return;
                                            }

                                            info = /INFO.{4}([^\x00]{1,247})\x00([^\x00]*)\x00([^\x00]*)\x00([^\x00]*)/.exec(buffer);

                                            if (info) {
                                                file.levels[index].name = info[1];
                                                file.levels[index].author = info[2];
                                                file.levels[index].copyright = info[3];
                                                file.levels[index].description = info[4];
                                            }

                                            nextLevel();
                                        });
                                    }());
                                }(function() {
                                    // Close the mn3 file.
                                    fs.close(fd, function() {
                                        callback();
                                    });
                                }));
                            });
                        });
                    }());
                });
            }));
        });
    });
};

module.exports = mn3tools;
