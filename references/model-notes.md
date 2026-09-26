# Target model notes

Limits change often. These were checked in September 2026. If the tool shows a different maximum, use the tool's number and tell the user. When unsure, plan 8-second clips.

| Model (where) | Max per generation | Plan clips at | Ratios |
|---|---|---|---|
| **Omni Flash** (Gemini Omni Flash; Google Flow, Gemini API) | 3–10 s; extend in 10 s steps up to 40 s | ≤ 10 s | 16:9, 9:16 |
| **Veo 3.1** (Google Flow, Gemini API, Vertex) | 4, 6 or 8 s; extendable | ≤ 8 s | 16:9, 9:16 |
| **Kling 3.0** (Kling app/API) | up to 15 s, multi-shot storyboard | ≤ 10–15 s | 16:9, 9:16, 1:1 |
| **Seedance 2.0** (ByteDance; many hosts) | up to 15 s (2.5: up to 30 s) | ≤ 12–15 s | 16:9, 9:16, 1:1 and more |
| **Sora 2** (Sora app, OpenAI API) | about 4–12 s in the API; app plans may allow longer | ≤ 10 s | 16:9, 9:16 |
| **Runway Gen-4.5** (Runway) | 2–10 s | ≤ 10 s | 16:9, 9:16 and more |

Shorter clips hold timing and style better than long ones on every model. Two 5-second clips usually beat one 10-second clip.

## Per-model tweaks

**Omni Flash**
- Understands timecodes. Keep the `0.0s to 3.4s — ...` beat lines, and optionally add `[0-3s]` style labels.
- It renders on-screen text fairly well, but still use the text layer for anything that must be exact.
- It generates sound. Write `AUDIO: silent, voiceover added in edit` and mute the clip in the edit.
- Long, detailed prompts work well here. Keep every section.
- To keep one continuous shot, write "in a single unbroken scene" in FORMAT MODE.
- For continuity, extend the previous clip or start from its last frame.

**Veo 3.1**
- Strong camera language and lighting, weaker at small text. Prefer the text-free variant plus the text layer.
- 8 s max: split beats accordingly. Use Frames to Video with a keyframe (first frame) for style consistency.
- It generates audio: keep `AUDIO: silent, voiceover added in edit`, and mute in the edit.

**Kling 3.0**
- Multi-shot mode: each beat can be one shot. Keep the beat lines short (one to two sentences each).
- It may shorten very long prompts. Put FORMAT MODE and STYLE LOCK first and trim PHYSICS-like detail if it runs out of room.
- Image-to-video with a keyframe gives the most stable style.

**Seedance 2.0 / 2.5**
- Handles multi-shot sequences and reference images well. Attach the keyframe and, if allowed, a still of the reference as a style reference.
- Keep text short; use the text layer for numbers.

**Sora 2**
- Good physical realism and camera moves; stylised flat graphics can drift toward realism. Say "flat 2.5D motion graphic, not photographic" in STYLE LOCK when the reference is graphic.
- Can add dialogue or sound; keep AUDIO silent.

**Runway Gen-4.5**
- Short, direct prompts work better. Condense each beat to one sentence and keep STYLE LOCK to 3–4 lines.
- Image-to-video from a keyframe is the most reliable path; describe motion, not the whole scene.

## All models
- One clear change per second, at most.
- Name the transition from the reference (whip, blur, scroll, scale-push, match cut) between beats; otherwise "HARD CUT".
- Describe recurring objects with the same words in every clip.
- Clip timing drifts about ±0.5 s from the prompt. Place clips by their "Place at" times and trim in the edit.
