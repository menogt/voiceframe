# Voiceframe by Meno

**v1.0** · by Menaka Perera · MIT License

Give Claude a motion-graphics video you like and your own voiceover. You get AI video prompts that copy the look, with every beat timed to your voice, plus a perfectly spelled text layer that drops straight onto your timeline.

**Before:** a reel you like and an MP3 of your narration.
**After:** a style bible, a beat sheet timed to the word, one copy-paste prompt per clip for Omni Flash / Veo / Kling / Seedance / Sora / Runway, and a text-overlay video (transparent MOV plus a green-screen MP4) already synced to your voice.

## Install
1. Download `voiceframe-by-meno.zip`.
2. In Claude, open **Settings**, go to the **Skills** section (under Capabilities) and upload the zip.
3. Turn on **code execution** (the skill runs ffmpeg and a small renderer).

## What to attach
- **Reference video** (the style). Under 60 seconds works best. Reels, explainers and ads all work.
- **Your voiceover audio** (best: timing comes from your actual voice) and/or **your script**. A captions file (`.srt` or `.vtt`) from CapCut, Premiere or YouTube also works as the script.

Then say something like *"recreate this style for my voiceover"*. Claude asks one question with defaults (ratio, test or full, text layer, target model). Reply "go" to accept them.

Scripts can use tags. They are optional:
```
[VO] It's three in the morning somewhere, and someone is awake.
[VIS] AI — a phone screen is the only light in a dark room
[TEXT] 3 a.m.
[BEAT]
[VIS] STOCK — empty street at night
```
`[VO]` spoken · `[VIS]` / `[VIS] AI` / `VEO` / `DATA` → Claude writes a prompt · `[VIS] STOCK` / `CANVA` / `Title card` → goes to your sourcing list · `[TEXT]` → exact words for the text layer · `[BEAT]` → a pause and a good place to cut.

## What you get
1. **Style bible**: palette with hex codes, typography, motion, transitions and pacing, taken from the reference (style only).
2. **Beat sheet**: every beat with its time on your voiceover and the emphasis word.
3. **One prompt per clip**, sized to your model's maximum length, each marked "Place at X.XX s", plus a **text-free version**.
4. **Keyframe image prompts** (optional) for image-to-video, which keeps clips consistent.
5. **Text layer video**: the on-screen words appear exactly as you say them. You get `TextLayer_transparent.mov` (Premiere, DaVinci, After Effects, Final Cut), `TextLayer_greenscreen.mp4` (CapCut: Cutout → Chroma key) and a preview with your audio.
6. **Sourcing list** for stock or Canva shots, an optional **SFX cue list**, and short **assembly notes**.

## More you can do with it
- **Styled captions for any video.** Skip the reference video and just attach your voiceover, a talking-head clip or a podcast audio file with its script. The text layer turns into word-by-word captions, each word timed to the moment it is spoken, in the font, colours and animation you choose (blur-rise, pop, slide, fade, typewriter). You get a transparent overlay ready to drop on your edit. Try: *"make styled captions for this voiceover, bold white words, yellow emphasis word, pop animation"*.
- **Kinetic typography only.** Ask for the text layer alone, with no video prompts, for lyric videos, quote reels or stat highlights.
- **Your own brand look.** Give brand colours and fonts, and they replace the reference palette in every prompt and in the text layer.
- **Tweak anything.** The text layer is driven by a simple JSON config, and the prompts follow a documented template, so you can ask Claude to change positions, sizes, timing, animation style or the target model and rerun. Experiment: most things can be adjusted by just asking.

The first run does **test mode** (Clip 1 only) so you can check the look before doing the whole video. Say "full video" to continue.

## Limitations
- It does not generate a talking presenter or lip-synced avatar (use a tool like HeyGen for that). Captions and text are synced to your voice at the word level.
- AI video models drift about ±0.5 s from the timestamps in a prompt; trim clips in your editor. The text layer is frame-accurate.
- How well text shows up inside AI clips depends on the video model. Use the text-free prompts plus the text layer for perfect spelling.
- Style only: logos, brand names, watermarks and real people from the reference are never copied.
- Word timing works offline for English. Other languages fall back to pause-based timing (still good for clip cuts; word-level text sync is approximate).
- Model length limits change often. Check `references/model-notes.md` against your tool.

## Files
```
SKILL.md                     workflow Claude follows
references/                  prompt, keyframe and tag guides, model notes, a worked example
templates/text_layer.html    kinetic-typography template (open it in a browser to preview)
scripts/analyze_audio.sh     duration, pause map and word timestamps for the voiceover
scripts/render_text_layer.js renders the text layer to MOV / MP4
```

## License
MIT. Free to use, modify and share; keep the copyright notice in `LICENSE`.

## Changelog
- **v1.0** (September 2026): first public release. Forced-alignment word timing with automatic detection of lines missing from the audio; kinetic text layer with spoken-word sync, auto-shrink and ProRes / Animation / green-screen outputs; ffmpeg fallback when no headless browser is available; model notes for Omni Flash, Veo 3.1, Kling 3.0, Seedance 2.0, Sora 2 and Runway Gen-4.5.
