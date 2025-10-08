# Sound Effects

This directory contains sound effect files for the game.

## Files

Copy your sound files here:
- `click1.mp3` - Tile placement sound variant 1
- `click2.mp3` - Tile placement sound variant 2
- `click3.mp3` - Tile placement sound variant 3
- `click4.mp3` - Tile placement sound variant 4
- `click5.mp3` - Tile placement sound variant 5

The game will randomly select one of these sounds each time a tile is played or placed on the board.

## Volume

The default volume is set to 50%. You can adjust this in the `useSoundEffects.js` composable by calling `setVolume(0.5)` where the value ranges from 0.0 (mute) to 1.0 (full volume).
