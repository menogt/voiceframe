# Keyframe image prompt template (first frame of a clip)

Use when keyframes are on. One image per clip, matching the clip's FIRST FRAME. The user generates it (GPT Image, Imagen, Midjourney, Flux…) and then runs image-to-video with the clip prompt. Starting every clip from a keyframe keeps colours, objects and layout consistent across clips.

```
<16:9 horizontal, 1920 x 1080> still frame, first frame of a motion-graphics clip.

STYLE: <the STYLE LOCK, condensed to 3–5 sentences: background material and hex, grid or texture, decoration shapes and where they are cropped, accent colours with roles, object look (flat 2.5D icons / black-and-white photoreal cut-outs / 3D), shadow direction>.

COMPOSITION: <every element of FIRST FRAME with position as % across and % down and size as % of frame height>. The <upper-left> third is empty <paper>, reserved for titles.

LIGHT: <key light direction and softness, glows, white balance>.

FINISH: clean edges, no film grain, flat even exposure, sharp focus across the frame. Screens and papers show only plain surfaces or grey placeholder bars. The image contains shapes, objects and photographs only.
```

Tips for the user:
- Generate at the output ratio (16:9 or 9:16), not the reference's ratio.
- Keep the same seed or reference image across clips if the tool allows it.
- If the image tool adds stray letters, regenerate or paint them out before image-to-video.
- For clip 2 onward, the previous clip's last frame (exported from the video) works as the keyframe too.
