# Descent 3 MN3 Tools

A cross-platform Descent 3 mission parser implemented in node.js.

## Usage

Descent 3 MN3 Tools is extremely easy to use:

```
var mn3tools = require("descent3mn3tools");

mn3tools.parse("c:\\Games\\Descent3\\missions\\indika3.mn3", callback(err, file) {
    // Do something with file here!
});
```

A note that you do not have to separately parse d3.mn3 and d3_2.mn3, this module will include the second MN3 file while querying the first.

## Performance notes

Using Descent 3 MN3 Tools is extremely fast when used on a single MN3 file.  However, take care that processing an entire directory of MN3 files can take a good amount of time, on the order of minutes for large directories on slow drives.  Keep this in mind when writing a front end that queries a large number of MN3 files at once.

## MN3 File object properties

### Guaranteed properties

Only two properties are guaranteed on a ```file``` object:

`file.exists` - Indicates whether the file exists or not.

`file.filename` - The original filename passed into the function.

### Guaranteed properties on a valid MN3

The following properties will appear on every file that is a valid MN3.

`file.entries` - The entries in the MN3.  This is an array of files the MN3 archive contains.

`file.numFiles` - The number of files contained within the MN3 archive.

`file.offset` - The offset in bytes to the first file in the MN3 archive.

### Properties on entries

Each entry in `file.entries` has the following properties.

`entry.bytes` - The size of the file in bytes.

`entry.filename` - The filename of the file.

`entry.offset` - The offset in bytes to the file in the MN3 archive.

### Other properties on a valid MN3

The following properties may appear on a valid MN3.

`file.author` - The author of the mission.

`file.description` - The description of the mission.

`file.gameTypes` - An object containing the supported game types by the mission.

`file.levels` - An array of levels contained in the mission.

`file.name` - The name of the mission.

`file.numLevels` - The number of levels in the mission.  Note that this may not be accurate, use `file.levels.length` for a list of valid levels in the mission.

`file.urls` - An array of URLs that the mission is available to be downloaded from.

## Keys and values on game types

Each key in `file.gameType` indicates the type of game the mission supports.

`file.gameTypes.ctf` - Indicates the the mission supports capture the flag, or other games that support games that have a goal area for each team.

`file.gameTypes.monsterball` - Indicates that the mission supports monsterball.

`file.gameTypes.multiPlayer` - Indicates that the mission is loadable in multiplayer.

`file.gameTypes.singlePlayer` - Indicates that the mission is loadable in single player.

`file.gameTypes.teams` - The number of supported teams.

Further, if the mission has additional keywords that indicate unknown game types (such as Guardian), this will be included as a boolean property on `file.gameTypes` (such as `file.gameTypes.guardian`).

### Properties on levels

Each entry in `file.levels` may have the following properties.

`level.branch` - The level to proceed to upon completion of this level.

`level.briefing` - The filename of the briefing for the level.

`level.endMovie` - The filename of the movie that plays upon completion of the level.

`level.introMovie` - The filename of the movie that plays prior to the level.
 
`level.lastLevel` - Indicates that this is the last level in the mission pack.  Used in missions that have secret levels that come after the last level.

`level.mine` - The filename of the level file.

`level.progress` - The filename of the image displayed when the level is loading.

`level.score` - The filename of the score screen for the level.

`level.secret` - If the level contains a secret exit, this indicates the level number in the mission to jump to.

## History

### Version 0.1.2 - 7/7/2015

* Fixed a bug with the `safeexec` RegExp extension.

### Version 0.1.1 - 7/3/2015

* Fixed bug with assigning the hoard game type.

### Version 0.1 - 7/1/2015

* Initial version.
