# Reading production tags in scripts

Scripts often mark what is spoken, what is shown and where to pause. Read tags case-insensitively, with or without backticks, brackets or bold, and with any separator after the tag (` — `, `:`, `-`, a space). Unknown tags: treat as a note and mention them once.

## Tag table

| Tag (and common variations) | Meaning | Where it goes |
|---|---|---|
| `[VO]`, `VO:`, `NARRATION`, `V/O`, `[SPEAKER]` | Spoken line | Spoken-text file for timing; beats; never shown as text unless also in `[TEXT]` |
| `[VIS]` with no source, `[VIS] AI`, `[VIS] VEO`, `[VIS] SORA`, `[VIS] KLING`, `[VIS] GEN`, `VISUAL:` | AI-generated visual | Write a clip prompt |
| `[VIS] DATA`, `[VIS] INFOGRAPHIC`, `[VIS] CHART`, `DATA —` | Animated data graphic | Write a clip prompt (bars, counters, grids). Put exact numbers in the text layer, not in the AI prompt |
| `[VIS] STOCK`, `[VIS] FOOTAGE`, `[VIS] B-ROLL`, `PEXELS`, `PIXABAY` | Real footage | SOURCING LIST (no prompt) |
| `[VIS] CANVA`, `[VIS] GRAPHIC` (made by hand), `[VIS] Title card`, `TITLE`, `LOWER THIRD`, `LOGO` | Designed by the user | SOURCING LIST with style notes (no prompt) |
| `[TEXT]`, `ON-SCREEN:`, `SUPER:`, `CAPTION:` | Exact on-screen words | Text layer (exact words; the styling hints guide the style) |
| `[BEAT]`, `[BEAT] — 1 second`, `[PAUSE]`, `(beat)` | Planned silence | Preferred clip boundary; hold the last frame |
| `[SFX]`, `SFX:` | Sound effect note | SFX cue list (if on) |
| `[MUSIC]`, `MUSIC:` | Music note | Closing notes only |

If the script has a legend (for example "`CANVA` = you build it · `STOCK` = Pexels · `VEO` = AI generated · `DATA` = infographic"), the legend wins over this table.

## How far a [VIS] reaches
A `[VIS]` covers the VO that follows it until the next `[VIS]`, `[BEAT]` or section heading. VO before the first `[VIS]` of a section gets its own AI visual. Long `[VIS]` stretches are split into several clips at pauses, all following the same visual idea.

## [TEXT] details
- Keep the exact characters, including numbers and symbols (`72%`, `1 in 3`).
- Separators such as `·`, `/`, `|` or line breaks split one cue into several text items, shown one at a time in order.
- Styling hints (`large, centred`, `small, corner`, `bold`, `*italic*`, `held on screen`) set the style, position and hold time. Strip markdown (`**`, `*`) from the words.
- Timing: each item appears when its words (or their spoken form) are said. Add `"say"` in the text config when the screen text differs from the speech (`72%` → `seventy-two`, `52%` → `half`, `1 in 3` → `third`). With no matching speech, place it right after the VO line it follows.
- `[TEXT]` never goes into the spoken-text file.

## Spoken-text file for timing
Only the `[VO]` lines, in order, as plain sentences. Remove tags, markdown, stage directions and headings that are not read aloud. Keep numbers as written; the aligner expands them (`2025` → "twenty twenty-five", `72%` → "seventy-two percent"). If the narrator reads headings or labels aloud (for example "Three: it's there at three in the morning"), include them. The analysis report flags this when the text and audio end at different times.

## Worked example
```
`[VO]` Before we get anywhere near that, though, you need to know how ordinary this already is.
`[VIS]` DATA — bar building upward
`[VO]` In 2025, Common Sense Media surveyed ... thirteen percent were using one every single day.
`[TEXT]` 72% · 52% · 13%
`[BEAT]`
`[VIS]` CANVA — a single dot, then a field of thousands of dots
`[VIS]` STOCK — ordinary people, commuting, working, waiting
```
- First VO line: no `[VIS]` yet, so it gets its own AI clip.
- `DATA — bar building upward`: AI prompt(s) for the following VO; the three numbers go in the text layer.
- `72% · 52% · 13%`: three text items, timed to "seventy-two", "half", "thirteen".
- `[BEAT]`: clip boundary.
- `CANVA` and `STOCK` lines: sourcing list only, with their VO times.
