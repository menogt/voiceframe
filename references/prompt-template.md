# Clip prompt template

One prompt per clip, in its own code block, with this line above it:

`Place at VO X.XXs → Y.YYs` (the clip's start and end on the voiceover timeline)

Sections go in this order, nothing else inside the block. Replace every `<...>`.

```
SCENE CONTEXT
<Two or three lines: what the clip is, the subject, and the beats as a stated progression, e.g. "Two timed beats move from a path that stops short of its goal to an ordinary phone lighting up among everyday objects.">

STYLE LOCK
<Identical, word for word, in every clip of the video. 5–8 sentences from the style bible: background (material, hex, grid or texture with spacing, vignette); midground decoration (shapes, sizes as % of frame height, hex, where they are cropped, how they move); accents (hex + role each); object look (flat 2.5D icons / photoreal cut-outs / 3D, shadow offset, blur and opacity); motion language (easing, overshoot, how things enter and exit); render traits (grain, bloom, edges).>

FIRST FRAME
<Frame one only: what sits where (positions as % across and % down), sizes as % of frame height, camera height and angle, what is already visible or lit. Clip 2 onward: "Continues from the previous clip's last frame:" followed by that composition. Name the empty third reserved for text.>

FORMAT MODE
Timed multishot, <N.N> seconds. Cuts only at the specified points, the camera does not cut on its own.

0.0s to <a>s [VO: "<exact words spoken in this beat>"] — <shot>, <camera move>, <subject action with positions and sizes>, <light>. Emphasis at <e>s: <the one biggest visual change, on the emphasis word>.

<a>s <TRANSITION NAME FROM THE REFERENCE, e.g. WHIP-LEFT TRANSITION (layout exits left in 0.2 s with horizontal blur) / SCROLL-UP TRANSITION / SCALE-PUSH / HARD CUT>

<a>s to <b>s [VO: "..."] — ... Emphasis at <e>s: ...

CAMERA + OPTICS
<Per beat: shot size, horizontal field of view in degrees, focus, move in real units (1.00x to 1.04x zoom over 2.6 s; drift 3 % of frame height per second; roll 10 degrees per second). Square-on or angle. "No drift mid-beat except where stated.">

LIGHTING + COLOR
<Each light source with direction in degrees, hardness and colour; glows with radius in px; haze %; white balance in Kelvin. Two or three colours maximum, each with a named role (which carries the volume, which is the accent), plus black level.>

ON-SCREEN TEXT
<Exact words in 「」, max 4 words per beat, one text element on screen at a time. For each: beat, time it appears (the spoken word), position (e.g. upper-left third, 7 % from left, 12 % from top), font look (bold geometric sans / italic serif), size as % of frame height, colour hex, entry (resolves from a horizontal blur word by word), exit.>

LAST FRAME
<The final composition in the same detail as FIRST FRAME. The next clip starts from it.>

OUTPUT SETTINGS
<16:9 horizontal, 1920 x 1080> (or 9:16 vertical, 1080 x 1920), <N.N> seconds, real-time speed, motion blur on fast moves at 30 fps.

AUDIO
silent, voiceover added in edit

POSITIVE LOCKS
<4–8 short lines of what stays identical in every beat, each phrased as something present, never "no X": background and decoration present in every beat; camera constraint; colour-role boundaries; subject count; reserved text area; shadow direction.>
```

## Text-free variant
Give it right after each prompt, as a replacement for the ON-SCREEN TEXT section plus one extra lock line:

```
ON-SCREEN TEXT
The frame carries shapes, icons and photographs only. The <upper-left> third stays empty <grid paper> in every beat, reserved for titles added in edit. Screens, signs, papers and packaging show plain surfaces or grey placeholder bars.

(add to POSITIVE LOCKS) The <upper-left> third is clear, empty <paper> in every beat.
```
Pick the third that the text layer uses, and keep it the same across the video.

## Detail level (this is what makes output good)
- Positions as % across and % down; sizes as % of frame height; one hex per coloured element.
- Start state and end state for everything that moves; easing (ease-out with 6 % overshoot, settles in 0.12 s); rates (one per 0.3 s, 1 revolution per 20 s, 3 % of frame height per second).
- Beat times relative to the clip start, from `words.json`. The emphasis change lands on the emphasis word's start time.
- Plain declarative sentences. No "stunning", "cinematic", "breathtaking", "epic".
- At most one clear change per second. Beats 2–4 s.
- Literal to the VO line: show what is being said (a survey → a card being ticked; "a city" → a skyline), in the reference's visual language.
- Recurring objects use the same words in every clip ("black-and-white photoreal smartphone cut-out, 38 % of frame height").
- Describe only what should be on screen. Put "keep" rules in POSITIVE LOCKS as present things.
- Never name real brands, logos, apps or real people. Screens and documents show grey bars.

## Checks before sending
- Beat times start at 0.0, chain without gaps and end exactly at N.N; N.N ≤ the model's max.
- Clip start and end sit inside pauses from the audio report.
- Every beat has a `[VO: ...]` quote and an `Emphasis at` time.
- STYLE LOCK text is identical across clips; FIRST FRAME of clip k+1 matches LAST FRAME of clip k.
- ON-SCREEN TEXT words match the text layer exactly.
