# SFX library

These 16 files (`{id}.mp3`, one per `SFX_META` id in `@sentezy/types`) are the sound
effects the AI "suggest sound effects" feature can place into a reel.

**⚠️ Placeholder audio.** The current files are synthesized single-tone placeholders
(generated with ffmpeg `sine` at distinct frequencies/durations per effect) so the feature
is end-to-end functional and testable. They are not sourced from any third party and carry no
license restrictions, but they are NOT final production audio. **Replace them with real,
curated royalty-free SFX** before shipping — keep the exact filenames (`{id}.mp3`) and record
each file's source URL + license here when you do.

The same files live in `apps/worker/sfx/library/` (used by the ffmpeg final render). Keep the
two directories in sync.

| id | intended sound |
|----|----------------|
| whoosh | transition / swipe |
| ding | highlight / correct |
| pop | small reveal |
| boom | impact / big reveal |
| applause | success / celebrate |
| cash | money / sale |
| riser | buildup / tension |
| click | tap / ui |
| swoosh | fast motion |
| sparkle | magic / shine |
| airhorn | hype / attention |
| thud | drop / land |
| bell | notify / alert |
| record_scratch | stop / twist |
| whistle | rise / fall |
| camera | photo / snapshot |
