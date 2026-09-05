# Loopwright: Play Store listing

**Package:** com.mohdshayan.loopwright
**Category:** Music & Audio
**Pricing:** Free. No in-app purchases, no subscription, no ads.

## Title (23 / 30)
Loopwright: Hum to Song

## Short description (78 / 80)
Hum a melody, beatbox a beat, and loop them into real songs. No theory needed.

## Full description (3915 / 4000)
Everyone has melodies. Almost nobody has an instrument, theory, or a studio they understand. Loopwright closes that gap with the oldest interface there is: your voice.

Hum something. It comes back as a felt piano, in time and in key. Say boots and cats over it. That comes back as drums. Stack a bass line under both, drop layers in and out while it plays, and ten minutes later a person who has never played anything has made something that sounds like music.

YOUR VOICE IS THE INSTRUMENT
Nobody hums accurately, so the app is built around that instead of against it. It tracks your pitch note by note, works out the key you are implying and moves your wobbly notes into it, then pulls your timing towards the grid without flattening the character out of it. A slider on every layer runs from exactly as you played it to exactly on the grid, and it starts most of the way towards you.

Beatboxing is sorted the same way. Where the energy of a sound sits decides whether it lands as a kick, a snare or a hat, and the groove you actually mouthed is kept.

Your original take is kept too. One toggle plays your own voice back in place of the instrument, so you can always hear what you really sang.

LOOP LIKE A BUSKER
One screen, one big pad. Tap and hum, tap again to close the loop, and it starts cycling immediately. Tap once more to overdub the next layer, which lands exactly one loop long. Up to eight layers a scene, arranged as a ring of glowing segments around the pad.

Tap a segment while it plays and that layer drops out of the mix. Tap it again and it comes back. Muting and un-muting live is most of what makes looping feel like playing, and it costs no theory at all.

The tempo is whatever your first take was. Everything after it conforms.

SEVEN INSTRUMENTS AND TWO DRUM KITS
Not five hundred presets behind a search box. Nine voices with names and opinions.

Felt, a piano with the hammers muffled. Dust, a lo fi synth warbling like stretched tape. Upright, a double bass with the fret noise left in. Brass Sunday, three soft horns. Choirette, your melody sung back by a small room of yous. Nylon, a plucked bedroom guitar. Glass, a music box. Kit, tight studio drums. Cardboard, a box and a knee and a shush.

Every one of them is built out of oscillators and filters at the moment it sounds, which is why the whole app is tiny and works in airplane mode. Any layer can be re-voiced afterwards with one tap.

FROM LOOP TO SONG
A set of loops is a scene. Copy it, mute two layers, add one, and the copy is your chorus. Line the scenes up in a strip, say how many times each goes round, and that is a song. One button will propose intro, verse, chorus, verse, chorus, out if you would rather not decide.

Export the finished mix as a WAV, or one WAV per layer if you want to keep working somewhere else.

YOURS TO KEEP
Loopwright does not request the internet permission, so Android will not let it open a connection at all. You can check that on this listing before you install. No account, no sign in, no cloud, no analytics, no advertising ID, no crash reporter.

Your songs, your layers and your recordings live in this phone's private storage. Delete a song and its recordings go with it. Two taps in Settings erase everything.

No watermark is ever added to your audio and nothing is claimed over what you make. Your songs are yours, including commercially.

The app is free and complete. No subscription, no in-app purchase, no locked voices, no export cap, no adverts. Two permissions: the microphone, because it listens to you, and vibration, for the count-in you can feel.

WORTH KNOWING
Headphones help a great deal. Without them the microphone hears the loop as well as it hears you.

There is no feed, no profile and no community inside Loopwright. You share a song by exporting the file and sending it to whoever you like.

You have been humming it for years. Give it four seconds.

## Contact
Email: shayanm2002@gmail.com
Website: https://shayanmohd.github.io/loopwright/
Privacy policy: https://shayanmohd.github.io/loopwright/privacy-policy.html

## Declarations (read off the built manifest and the code, not assumed)
- Permissions declared: `android.permission.RECORD_AUDIO`, `android.permission.VIBRATE`, and the
  signature-level `com.mohdshayan.loopwright.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` that androidx.core
  adds to every app. No INTERNET. No storage, camera or location. Verified with `aapt2 dump badging`
  on the release APK.
- `android.hardware.microphone` is implied by RECORD_AUDIO and is therefore a required feature. The app
  is useless without a microphone, so that restriction is correct.
- Ads: none. No advertising SDK is present in the bundle.
- Data collected or shared: none. Nothing leaves the device, and the app cannot open a network connection.
- Advertising ID: not used.
- App access: every feature is available with no login of any kind.
- In-app purchases: none.
- Government, financial or health features: none.
- User-generated content and user-to-user communication: none. There is no feed, no profile, no upload
  and no messaging. Songs leave the app only as WAV files the user exports and shares themselves.
- Audio recording: the microphone is used only while a take is running, released when the app is
  backgrounded, and the audio is analysed on the device. A short 16 kHz copy of each take is stored
  locally so the user can compare their voice against the instrument. Nothing is transmitted.
- Target audience: 13 and over. Nothing in the app is directed at children.
- Content rating questionnaire: no violence, no sexual content, no profanity, no controlled substances,
  no gambling, no user-generated content sharing, no user-to-user communication, no location sharing.
- AI-generated assets: none. The icon and feature graphic are drawn procedurally in code from a small
  JSON spec; the six screenshots are captures of the running app; every sound is synthesised on device.
