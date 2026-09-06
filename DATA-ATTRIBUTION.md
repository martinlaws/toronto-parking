# Data attribution

The 60 boards in `data/deck.json` and the 1,000 rows in `tests/fixtures/rush1000.txt` are derived from Michael Fogleman's Rush Hour database (https://www.michaelfogleman.com/rush/; `rush.txt.bz2` sha256 `73f382ffe3462cff5fcb9e2eb47cf9d69d7ed3fdf9515c9a5a03c90d3805d64c`, `rush.txt` sha256 `fca9f04db491415ac257416cd25b304670f2859f5f1bb1f4948c7f30ba14626f`, Last-Modified 2018-07-16), the output of his MIT-licensed solver at https://github.com/fogleman/rush. The database itself carries no licence text; its author published it "available for download" and asked to be told "if you do anything interesting with the code or the database". This project uses it on that invitation, not under any grant, and claims no rights over the boards: each card keeps Fogleman's 36-character board string in its `board` field, the pylons are his "walls" (never part of the original game), and if he asks for different wording, different credit, or removal, this file, the deck and the fixture change to match.

Courtesy email sent {date}; reply: {quoted, or "none by the day the boxes shipped"}.

RUSH HOUR is a registered trademark of Ravensburger North America, Inc. This site is not affiliated with or endorsed by Ravensburger or ThinkFun.
