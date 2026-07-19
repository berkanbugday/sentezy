# Background music credits

**No track in this catalog requires attribution.** Every entry is either the original
Pixabay Content License track (Task 8) or CC0 1.0 Universal / Public Domain Dedication
(Task 9b). None of them obligate Sentezy or its users to display a credit in published
videos. This replaces an earlier batch of 8 CC BY 4.0 (incompetech.com) tracks added in
Task 9 — CC BY requires attribution and was incompatible with embedding music into
commercially published videos, so that batch was fully removed (R2 objects deleted,
`music.json` entries removed, DB rows pruned) and replaced with the attribution-free
tracks below.

Tracks are stored in R2 under `music/` and catalogued in `music.json` (seeded into the
`music_catalog` table via `packages/db/prisma/seed.ts`, which now prunes any DB row whose
slug is no longer present in `music.json`).

## Original tracks (Task 8) — unchanged

| Slug | Name | Mood | License |
|---|---|---|---|
| `cinematic` | Sinematik | cinematic | Pixabay Content License |
| `calm` | Sakin | calm | Pixabay Content License |
| `upbeat` | Enerjik | upbeat | Pixabay Content License |

Source: https://pixabay.com/music/. Pixabay's Content License permits commercial use
without attribution (https://pixabay.com/service/license-summary/).

## New tracks (Task 9b) — CC0 1.0 Universal (Public Domain Dedication)

All 8 sourced from **opengameart.org**, each individually verified by reading the
track's own page, which displays exactly one license and links to
`http://creativecommons.org/publicdomain/zero/1.0/` (the CC0 legal-code page, confirmed
to read "no rights reserved" / public domain dedication language). No attribution,
credit, or link-back is legally required for CC0 — the per-track "author" fields below
are recorded only for provenance/transparency, not because they're owed.

| Slug | Turkish name | Mood | Author (OGA username) | Source page | Direct file | Duration |
|---|---|---|---|---|---|---|
| `firtinadan-sonra` | Fırtınadan Sonra | cinematic / Sinematik | eltonthomasmba | https://opengameart.org/content/inspirational-cinematic-ambient-after-the-storm | https://opengameart.org/sites/default/files/keyframe_audio-inspirational-cinematic-ambient-after-the-storm-133540.mp3 | 123s |
| `golge-cete` | Gölge Çetesi | cinematic / Sinematik | pro-sensory | https://opengameart.org/content/cinematic-horror-ganglands | https://opengameart.org/sites/default/files/cinematic_entrance_gang_lands_by_alex_mcculloch_0.mp3 | 74s |
| `huzurlu-an` | Huzurlu An | calm / Sakin | wipics | https://opengameart.org/content/calm-loop | https://opengameart.org/sites/default/files/Relaxing_0.mp3 | 19s |
| `sakin-kasaba` | Sakin Kasaba | calm / Sakin | aroachifoundonmypillow | https://opengameart.org/content/peaceful-town | https://opengameart.org/sites/default/files/peacful_town_0.mp3 | 116s |
| `nese-dolu` | Neşe Dolu | upbeat / Enerjik | wipics | https://opengameart.org/content/happy-loop | https://opengameart.org/sites/default/files/happy%20loop_0.mp3 | 21s |
| `zafer-ani` | Zafer Anı | upbeat / Enerjik | cynicmusic | https://opengameart.org/content/victory-theme-for-rpg | https://opengameart.org/sites/default/files/Victory1_1.mp3 | 57s |
| `motivasyon-dalgasi` | Motivasyon Dalgası | corporate / Kurumsal | pro-sensory | https://opengameart.org/content/motivation-to-wake-up | https://opengameart.org/sites/default/files/motivation_to_wake_up_0.mp3 | 170s |
| `basari-ani` | Başarı Anı | corporate / Kurumsal | emmama | https://opengameart.org/content/triumphant | https://opengameart.org/sites/default/files/triumphant_0.mp3 | 27s |

All 8 were checked against their page's own description/tags for any mention of vocals,
lyrics, or singers before being accepted — none had any (all instrumental: ambient pads,
percussion, piano, strings/horns, synth). License verification method per track: fetched
the track's `opengameart.org/content/<slug>` page directly, confirmed it lists exactly
one license entry, and that the license icon links to
`http://creativecommons.org/publicdomain/zero/1.0/`.

## Removed tracks (Task 9, deleted in Task 9b)

The following 8 tracks were added in Task 9 from **incompetech.com** under **Creative
Commons: By Attribution 4.0 (CC BY 4.0)**, which requires a visible credit in every
published video. The product owner decided this was impractical and legally risky for
an ad-generation product, so all 8 were removed: R2 objects deleted
(`music/<slug>.mp3`), `music.json` entries removed, and the corresponding
`music_catalog` DB rows pruned by the updated `seedMusicCatalog`.

`gothamlicious`, `gerilim-yaklasiyor`, `sabah-huzuru`, `aksam-sakinligi`,
`nesheli-pazartesi`, `enerji-akisi`, `motivasyon`, `sunum-zamani` — all by Kevin
MacLeod (incompetech.com), CC BY 4.0. None of these slugs exist anywhere in this
repository anymore outside of git history and this note.

## Rejected candidates (Task 9b)

- **freepd.com** — the brief's first suggested source. As of this task, the entire site
  serves a "Site Closed" / permanently-closed notice (verified via direct `curl`, HTTP
  200 on a static shutdown page); no catalog or license pages are reachable. Not used.
- **Free Music Archive, CC0-only** — reachable, but its advanced-search license facet
  (`Public Domain` checkbox) returned no usable filtered results in testing, and
  individual track pages don't reliably surface a single unambiguous license without
  per-track inspection at a scale that wasn't worth it once OpenGameArt's exposed CC0
  taxonomy term (`field_art_licenses_tid=4`) proved to give clean, individually
  verifiable results directly. Not used.
- **Openverse (`api.openverse.org`), CC0 filter** — used briefly; its `jamendo` source
  returned zero CC0 results for every query tried (Jamendo's Openverse index appears to
  have no CC0-licensed tracks at all), and its `freesound` source is one-shot sound
  effects / stingers rather than full instrumental background beds. The API also started
  returning HTTP 429 / a Cloudflare interstitial after a burst of requests. Abandoned in
  favor of OpenGameArt.org, which has a large, explicitly CC0-tagged Music category with
  full-length instrumental tracks.
- **OpenGameArt "progress" (Progress.ogg)** — CC0-tagged, but its own author's
  description reads "I DID NOT MAKE THIS!! This was composed by Tripcore... The reason
  it shows me as author is because there was no author field (some bug...)". Rejected:
  an uploader admitting they aren't the creator and can't confirm the true origin means
  the CC0 declaration on that specific upload cannot be trusted, regardless of what the
  page's license field says.
- **OpenGameArt "epic-endgame-cinematic"** — CC0-tagged and otherwise a strong
  cinematic candidate, but its own description explicitly says "Dramatic **female
  vocals** theme with horns..." — rejected for containing vocals (the whole point of
  going instrumental is to not fight the Turkish voiceover).
- Several other CC0 OpenGameArt candidates were downloaded/considered but not used
  once 2 tracks per mood were secured with an mp3 direct file (matching the addition
  script's mp3-only download path) and a confirmed non-vocal, reasonable-length loop —
  including `epic-main-menu-theme-loop` and `cinematic-percussion-loop` (both CC0, both
  `.wav`, set aside purely because the acquisition script downloads the source file
  as-is and names it `<slug>.mp3` without transcoding, so only already-mp3 sources were
  used to avoid mislabeling a WAV as an MP3 object in R2).
