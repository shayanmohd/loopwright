# Loopwright

**The song in your head, out loud.** A pocket loop pedal for people who never learned an instrument.
Hum a melody and it comes back as a felt piano. Say boots and cats and it comes back as drums. Stack
the loops, drop them in and out while it plays, arrange the scenes into a song, and export a WAV.

Android, free, offline. No account, no adverts, no in-app purchase, and no internet permission at all.

- Site and browser version: <https://shayanmohd.github.io/loopwright/>
- Privacy policy: <https://shayanmohd.github.io/loopwright/privacy-policy.html>

## What it actually does

**Listening.** `web/js/dsp.js` is the whole transcription pipeline and it is classical signal
processing, not a model. Pitch is tracked with a YIN style normalised difference function at 11 kHz,
runs of steady pitch become notes, and the key is chosen by correlating how long each pitch class was
held against Krumhansl and Kessler's tone profiles. Drum onsets come from spectral flux over a 512
point FFT, and where a hit's energy sits decides whether it is a kick, a snare or a hat. The tempo is
a grid search over sixteenths, eighths and beats with a log-normal prior around a walking pulse,
because half and double a tempo fit a sixteenth grid equally well and only a prior can break that tie.

**Forgiveness.** Quantisation is a pull towards the grid rather than a snap onto it. A swing pass
measures how late the offbeats are and preserves that lateness. A per-take shift search absorbs both
the phone's input latency and the human habit of playing slightly ahead. Every layer keeps its raw,
unquantised times forever, so the looser-to-tighter slider can change its mind without losing anything.

**Sound.** `web/js/voices.js` builds all nine voices out of oscillators, filters and noise at the moment
they are needed. Nylon is a real Karplus-Strong string rendered into a buffer, because a Web Audio
delay loop cannot go below one render quantum and would cap the pitch at about 344 Hz.

**Timing.** `web/js/engine.js` renders each layer ahead of time into a buffer exactly one loop long,
with its own decay tail folded back over the start so the seam is inaudible, then plays it as a single
looping source. Everything is placed in audio-clock seconds, never in `setTimeout` time.

## Layout

```
web/                 the app: no build step, no framework, no CDN, works offline
  index.html
  css/style.css
  js/voices.js       nine synthesised voices
  js/dsp.js          pitch, onsets, key, tempo, quantisation
  js/store.js        localStorage for songs, IndexedDB for the recordings
  js/engine.js       capture, loop transport, offline render, WAV export
  js/app.js          the three screens and the sheets
  js/capture-worklet.js
  fonts/             self-hosted Hanken Grotesk and Space Grotesk
android/             WebView shell: haptics, file export, share sheet, safe-area insets
docs/                the site, the privacy policy, and a playable copy of the app under docs/play
store/               brand spec, listing copy, screenshots and the screenshot seed
```

## Building

```sh
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew --offline bundleRelease assembleRelease
```

The web core is copied into `app/src/main/assets/www` by a Gradle task on every build, so there is
nothing to run by hand. Release signing reads `android/keystore.properties`, which is not in this
repository.

## Working on the web core alone

```sh
python3 -m http.server 8931 --directory web
```

Open <http://127.0.0.1:8931/>. Everything except the native haptics and the file export behaves
exactly as it does inside the shell; both are guarded with `window.Native &&` and fall back to
`navigator.vibrate` and an object-URL download.

`store/seed.js` writes a believable library into `localStorage` and a recording into IndexedDB. It is
used by the screenshot run and is handy for working on the screens without recording anything.

## Store assets

```sh
node ../_shiptools/shots.js store/shots.json          # six 1080x1920 captures
python ../_shiptools/brand.py store/brand.json --out store --res android/app/src/main/res
python ../_shiptools/privacy.py store/policy.json --out docs/privacy-policy.html
rsync -a --delete web/ docs/play/
```

The icon and the feature graphic are drawn from primitives in `store/brand.json`, so the listing can
answer the AI-assets question honestly.

## What was left out

Remix chains, publishing, forking and attribution trees all need a server and accounts, so none of
them are in this build and none of them are mentioned in the listing. MP3 export needs an encoder that
would have to be vendored; export is WAV. Live jam between two phones needs a network. See
`BLUEPRINT.md` for the full original scope.

Published by SocialSure Private Limited.
