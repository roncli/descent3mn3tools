var fs = require("fs"),
    mn3tools = {},

    // Get data from a file.
    getData = function(filename, start, end, callback) {
        "use strict";

        fs.open(filename, "r", function(err, fd) {
            var buffers = [],
                stream;

            if (err) {
                callback(err);
                return;
            }

            stream = fs.createReadStream("", {
                fd: fd,
                autoClose: false,
                start: start,
                end: end
            });

            stream.on("readable", function() {
                var data = stream.read();

                if (data) {
                    buffers.push(data);
                    return;
                }

                stream.close();
                stream = undefined;

                fs.close(fd, function() {
                    callback(null, Buffer.concat(buffers));
                });
            });
        });
    };

// A safe regexp exec method that does not leak memory.
RegExp.prototype.safeexec = function(string) {
    "use strict";

    var result = this.exec(string);

    if (result) {
        result.forEach(function(item, index) {
            result[index] = item.split("").join(""); //JSON.parse(JSON.stringify(item));
        });
    }

    return result;
};

mn3tools.parse = function(filename, callback) {
    "use strict";

    var file = {
        filename: filename
    };

    // Ensure the file exists.
    fs.exists(file.filename, function(exists) {
        file.exists = exists;
        if (!exists) {
            callback(null, file);
            return;
        }

        // Check for an _2 file.
        (function(callback2) {
            // Don't check for the file if we are already checking for it.
            if (/_2\.mn3$/.test(file.filename)) {
                callback2();
                return;
            }

            mn3tools.parse(file.filename.substring(0, file.filename.length - 4) + "_2.mn3", function(err, data) {
                if (err) {
                    callback(err);
                    return;
                }

                callback2(data);
            });
        }(function(file2) {
            // Get the header.
            getData(file.filename, 0, 11, function(err, headerData) {
                if (err) {
                    callback(err);
                    return;
                }

                var currentFile = 0,
                    currentOffset;

                if (headerData.toString(undefined, 0, 4) !== "HOG2") {
                    callback(null, file);
                }
                file.numFiles = headerData.readUInt32LE(4);
                file.offset = headerData.readUInt32LE(8);
                file.entries = [];

                currentOffset = file.offset;

                // Get the file entries.
                (function getEntry() {
                    getData(file.filename, 68 + (currentFile * 48), 68 + (currentFile * 48) + 43, function(err, entryData) {
                        if (err) {
                            callback(err);
                            return;
                        }

                        var entryFilename = entryData.toString(undefined, 0, 36).toString().replace(/[\x00\u0000][\s\S]*/g, ""),
                            bytes = entryData.readUInt32LE(40),
                            index;

                        file.entries.push({
                            filename: entryFilename,
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

                        getData(file.filename, file.entries[index].offset, file.entries[index].offset + file.entries[index].bytes - 1, function(err, msnData) {
                            if (err) {
                                callback(err);
                                return;
                            }

                            file.urls = [];
                            file.levels = [];
                            file.gameTypes = {};

                            msnData.toString().replace(/[\t ]+/g, " ").replace(/[\r\n]+/g, "\r").split("\r").forEach(function(line) {
                                var matches = /^ *([^ ]+) ?(.*)$/.safeexec(line);

                                if (matches) {
                                    switch (matches[1].toLowerCase()) {
                                        case "name":
                                            file.name = matches[2].trim();
                                            break;
                                        case "numlevels":
                                            file.numLevels = +matches[2];
                                            break;
                                        case "url":
                                            file.urls.push(matches[2].trim());
                                            break;
                                        case "author":
                                            file.author = matches[2].trim();
                                            break;
                                        case "single":
                                            file.gameTypes.singlePlayer = !(/^n/i.test(matches[2]));
                                            break;
                                        case "multi":
                                            file.gameTypes.multiPlayer = !(/^n/i.test(matches[2]));
                                            break;
                                        case "description":
                                            file.description = matches[2].trim();
                                            break;
                                        case "keywords":
                                            matches[2].toLowerCase().split(",").forEach(function(keyword) {
                                                keyword = keyword.trim();
                                                var goals = /^goals([1-9][0-9]*)$/.safeexec(keyword);
                                                if (goals) {
                                                    if (+goals[1] >= 2 && +goals[1] <= 4) {
                                                        file.gameTypes.ctf = true;
                                                        file.gameTypes.teams = +goals[1];
                                                    }
                                                    file.hoard = true;
                                                } else {
                                                    switch (keyword) {
                                                        case "goalperteam":
                                                            file.gameTypes.ctf = true;
                                                            break;
                                                        case "spec1":
                                                            file.gameTypes.monsterball = true;
                                                            break;
                                                        default:
                                                            file.gameTypes[keyword] = true;
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
                                            file.levels[file.levels.length - 1].briefing = matches[2].trim();
                                            break;
                                        case "score":
                                            file.levels[file.levels.length - 1].score = matches[2].trim();
                                            break;
                                        case "mine":
                                            if (matches[2].trim().length === 0) {
                                                file.levels.pop();
                                            } else {
                                                file.levels[file.levels.length - 1].mine = matches[2].trim();
                                            }
                                            break;
                                        case "intromovie":
                                            file.levels[file.levels.length - 1].introMovie = matches[2].trim();
                                            break;
                                        case "endmovie":
                                            file.levels[file.levels.length - 1].endMovie = matches[2].trim();
                                            break;
                                        case "progress":
                                            file.levels[file.levels.length - 1].progress = matches[2].trim();
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

                            (function(callback3) {
                                (function getLevel() {
                                    var entries = file.entries.filter(function(entry) {
                                        return entry.filename.toLowerCase() === file.levels[index].mine.toLowerCase();
                                    });

                                    function nextLevel() {
                                        index++;
                                        if (index < file.levels.length) {
                                            getLevel();
                                            return;
                                        }
                                        callback3();
                                    }

                                    if (entries.length === 0) {
                                        nextLevel();
                                        return;
                                    }

                                    getData(file.filename, entries[0].offset, entries[0].offset + entries[0].bytes - 1, function(err, rdlData) {
                                        if (err) {
                                            callback(err);
                                            return;
                                        }

                                        var info = /INFO.{4}([^\x00]{1,247})\x00([^\x00]*)\x00([^\x00]*)\x00([^\x00]*)/.safeexec(rdlData.toString());

                                        if (info) {
                                            file.levels[index].name = info[1].replace(/" {10,}.*$/, "").trim();
                                            file.levels[index].author = info[2].trim();
                                            file.levels[index].copyright = info[3].trim();
                                            file.levels[index].description = info[4].trim();
                                        }

                                        nextLevel();
                                    });
                                }());
                            }(function() {
                                callback(null, file);
                            }));
                        });
                    });
                }());
            });
        }));
    });
};

module.exports = mn3tools;
