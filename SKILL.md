---
name: voiceframe-by-meno
description: Use when the user attaches a reference motion-graphics, explainer or reel video plus their own voiceover audio and/or script, and wants AI video prompts (Omni Flash, Veo, Kling, Seedance, Sora, Runway) that copy the reference's style and are timed to their voiceover, and/or an accurately spelled kinetic-text overlay. Triggers on phrases like "recreate this style for my voiceover", "motion graphics for my script", "match this reel to my VO", "make prompts for my voiceover in this style", "sync visuals to my narration".
---

# Voiceframe by Meno

Turn a **reference video** (style only) plus the user's **voiceover and/or script** (content and timing) into: a style bible, a beat sheet timed to the audio, one copy-paste video prompt per clip (plus a text-free variant), optional keyframe image prompts, a rendered text-layer video, a sourcing list and short assembly notes.

Visuals are synced to the voiceover. There is no on-screen presenter. If the user asks for lip sync or a talking avatar, say in one line that it needs a different tool (for example HeyGen, or Veo with dialogue), then continue with the rest.

**Files** (paths are relative to this skill's folder): `scripts/analyze_audio.sh` (audio timing), `templates/text_layer.html` + `scripts/render_text_layer.js` (text layer). Read `references/*.md` when a step says so. Keep all user-facing text short and plain.

## Step 0 — One intake message, then no more questions
If the reference video, or both the VO and the script, are missing, ask for them (VO audio is strongly preferred; a script makes the timing more accurate). Otherwise send ONE message listing these defaults and start as soon as the user answers or says "go":
- Output ratio: **16:9** or 9:16 (independent of the reference's ratio)
- Scope: **test mode** (Clip 1 only, default on a first run) or full video
- Text layer: **on** or off. Text timing: **spoken words** or visual beats
- Keyframe images: **off** or on (for image-to-video). SFX cue list: **off** or on
- Target model: **Omni Flash**, Veo, Kling, Seedance, Sora, Runway

If the user already gave these, skip the question. If they are not around to answer, use the defaults and say so in one line.

## Step 1 — Analyze the reference (style only)
```bash
ffprobe -v error -show_entries format=duration:stream=width,height,r_frame_rate -of compact REF
ffmpeg -v error -i REF -vf "fps=2,scale=270:-1,tile=6x4" sheet_%02d.png   # fps=4 if cuts are fast
```
View every sheet; never guess from the filename. Write a **STYLE BIBLE** of 8–12 lines: palette (hex + role per colour), render look, motion language, transition type, average shot length, typography (weight, case, italic, how it reveals), background, lighting and grain. See `references/style-bible-example.md`.
Style only: never carry over logos, brand names, product shots, website screenshots, real people or watermarks. If the user gives brand colours, they replace the reference palette but keep the roles.

## Step 2 — Read the script and its tags
Follow `references/script-tags.md`: `[VO]` spoken, `[VIS]`/`[VIS] AI`/`VEO`/`DATA` = write a prompt, `[VIS] STOCK`/`CANVA`/`FOOTAGE`/`Title card` = sourcing list, `[TEXT]` = text layer, `[BEAT]` = preferred clip boundary. No tags: every line is VO and every beat gets an AI visual. Audio only: work from the transcript.

## Step 3 — Time everything to the audio (the audio wins)
1. Write the spoken words only (VO lines, in order, no tags or markdown) to `spoken.txt`.
2. Run `bash scripts/analyze_audio.sh VO spoken.txt audio_analysis` and read `audio_analysis/report.txt`. It gives duration, leading silence, the pause map (the only safe cut points), clause and word times (`words.json`), and flags lines that are missing from the audio. Methods: forced alignment (default, offline), Whisper (only without a script), or an estimate. Say which one was used.
3. Audio only and the report says Whisper is unavailable: ask for the script or a captions file (`.srt`/`.vtt` from CapCut, Premiere or YouTube; pass it as the text file). This is the one allowed follow-up question. Text only, no audio: estimate at 150 wpm and say the timings are estimates.
4. If the audio differs from the script, the audio wins; list the mismatched lines in one short list.

**Beats:** 2–4 s, one idea each, starting on a phrase start or stressed word. Mark one **emphasis word** per beat; the biggest visual change or text pop lands on it.
**Clips:** never longer than the target model's max (`references/model-notes.md`; if unsure, 8 s and tell the user to check). Put clip boundaries inside pauses or `[BEAT]` gaps, never mid-word.
Output the **BEAT SHEET**: Clip | Beat | Clip time | VO time | VO line | Emphasis | Visual idea | Source (AI/Stock/Canva) | On-screen text.
In test mode, do Clip 1 fully but still give the whole plan in one line ("7 AI clips, 3 stock shots").

## Step 4 — Adapt layout and check mood
- If the reference ratio differs from the output ratio, adapt the layout (vertical to horizontal: stacked text goes side by side, subjects move to a left or right third, text sits upper-left or in the lower third). Say it in one line.
- If the script's scene notes clash with the reference look (for example "dark room at night" vs a bright white style), say so in one line, keep the reference style, carry the mood with props and light accents, and offer the alternative palette.

## Step 5 — Write the prompts
Read `references/prompt-template.md` (sections, detail level, text-free variant) and apply the target model's tweaks from `references/model-notes.md`.
- Above each prompt: `Place at VO X.XXs → Y.YYs`. Each prompt goes in its own code block.
- Beat lines carry VO quotes and times relative to the clip start, taken from `words.json`.
- STYLE LOCK is identical in every clip. Clip 2 onward starts FIRST FRAME from the previous clip's LAST FRAME.
- Plain declarative sentences, real units (%, px, degrees, seconds, Kelvin, hex), no hype words, at most one clear change per second, visuals literal to the VO line, recurring objects described identically every time.
- More measurable detail gives better output: positions as % of frame, sizes as % of frame height, one hex per element, start and end states, easing and rates.
- After each prompt, give the TEXT-FREE VARIANT (replacement ON-SCREEN TEXT section).

## Step 6 — Keyframe images (only if on)
Per clip, one first-frame image prompt from `references/keyframe-template.md`. Tell the user: generate it (GPT Image or similar), then use image-to-video with the clip prompt.

## Step 7 — Text layer (default on)
Use the template and render script as they are; only write the data.
1. Write `text_config.json` (schema in the SAMPLE at the top of `templates/text_layer.html`; full example in `references/example-output.md`). Text comes from `[TEXT]` cues first, then each prompt's ON-SCREEN TEXT; max 4 words per item, one item on screen at a time.
2. Match the style bible: pick the closest free `@fontsource` family (Montserrat, Inter, Poppins, Oswald, Anton, Playfair Display, DM Serif Display...), its colours, and an animation: `blur-rise` (default), `pop`, `slide`, `fade`, `typewriter`.
3. Spoken-word timing: leave `t` out of the words and pass `--words`; each word appears when it is said. Add `"say"` when the screen text differs from speech (`{"w":"72%","say":"seventy-two"}`). Set `"emph": true` on the emphasis word. Visual-beat timing: set `t` from the beat times instead.
4. Render on the VO timeline so it drops in at 0.00 s: `node scripts/render_text_layer.js --config text_config.json --words audio_analysis/words.json --audio VO --out text_layer` (test mode: add `--from A --to B` for Clip 1's span and tell the user to place it at A).
5. Read `render_report.json` (warnings, shrunk items, estimated words), then view the stills to check spelling, clipping and position. Fix the config and re-render if anything is off.
6. Send `TextLayer_transparent.mov` (ProRes 4444 up to 60 s; QuickTime Animation for longer spans, which stays small; both keep transparency), `TextLayer_greenscreen.mp4` and `TextLayer_preview_with_audio.mp4`.
If no browser works the script falls back to ffmpeg drawtext by itself; say so.

## Step 8 — Extra lists
- **SOURCING LIST** (non-AI shots): VO time | line | source (stock/Canva/footage) | what to find | style notes to match.
- **SFX CUE LIST** (only if on): time | cue (whoosh, hit, riser, pop) | why. Keep it short.

## Step 9 — Closing notes (short)
- Sync: AI clips drift about ±0.5 s from prompt timestamps; place clips at their "Place at" times and trim or speed-adjust slightly. The text layer is frame-accurate.
- Text: video models can misspell. Use the text-free prompt plus the text layer for perfect text.
- Assembly: VO track; AI clips at their "Place at" times; stock/Canva shots; text layer on top at 0.00 s (or its stated start). CapCut: green-screen MP4, then Cutout → Chroma key. The MOV works as-is in Premiere, DaVinci Resolve, After Effects and Final Cut.
- Hard parts: name what the model will likely struggle with (hands, small UI text, morphs, continuity between clips) and the fix.
- Test mode ends with: "Happy with Clip 1? Say 'full video' and I'll do the rest."

## Reply order
Settings used (1 line) → style bible → beat sheet → mismatches (if any) → per clip: Place at line, prompt, text-free variant, keyframe prompt (if on) → sourcing list → SFX list (if on) → text-layer files → closing notes. Send files with the file-sharing tool, not as paths.
