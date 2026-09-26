#!/usr/bin/env bash
# analyze_audio.sh — time a voiceover so visuals and text can be synced to it.
#
# Usage:
#   bash analyze_audio.sh <voiceover-audio> [spoken-text.txt] [out-dir]
#
#   voiceover-audio   any format ffmpeg reads (m4a, mp3, wav, mp4 ...)
#   spoken-text.txt   optional. ONLY the words that are spoken, in order
#                     (strip [VIS]/[TEXT]/[BEAT] lines and markdown first).
#                     A captions file (.srt or .vtt) also works as-is.
#                     With it you get word timestamps by forced alignment.
#   out-dir           optional, default ./audio_analysis
#
# Writes to out-dir:
#   report.txt   human-readable summary: duration, leading silence, pauses,
#                speech segments, timed clauses, mismatch flags
#   pauses.json  [{start,end,dur}]        speech.json  [{start,end}]
#   words.json   {"method":..., "words":[{token,start,end,clause,est}]}
#   lines.txt    one line per clause: "start-end  text"
#
# Word-timestamp methods, tried in order:
#   1. forced alignment of the spoken text (pocketsphinx; its model ships
#      inside the pip package, so nothing is downloaded at run time)
#   2. faster-whisper transcription (only when no text is given; needs a
#      model download, which is often blocked in sandboxes)
#   3. estimate: words spread over the speech segments by character count
# The pause map (ffmpeg silencedetect) always works and is the ground truth
# for where clips can be cut.
#
# Env overrides: NOISE_DB (default -35), MIN_PAUSE (default 0.35)
set -euo pipefail

AUDIO="${1:?usage: analyze_audio.sh <audio> [spoken-text.txt] [out-dir]}"
TEXT="${2:-}"
OUT="${3:-./audio_analysis}"
NOISE_DB="${NOISE_DB:--35}"
MIN_PAUSE="${MIN_PAUSE:-0.35}"

command -v ffmpeg >/dev/null || { echo "ffmpeg is required"; exit 1; }
mkdir -p "$OUT"

# 16 kHz mono PCM copy used by every step
ffmpeg -v error -y -i "$AUDIO" -ac 1 -ar 16000 -f s16le "$OUT/vo.raw"
ffmpeg -v error -y -f s16le -ar 16000 -ac 1 -i "$OUT/vo.raw" "$OUT/vo16k.wav"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$AUDIO")

# Pause map
ffmpeg -v info -i "$OUT/vo16k.wav" -af "silencedetect=noise=${NOISE_DB}dB:d=${MIN_PAUSE}" -f null - 2>&1 \
  | grep -oE 'silence_(start|end): -?[0-9.]+' > "$OUT/silence.txt" || true

# Quietly try to install the aligner (works offline-model; pip registry only)
if [ -n "$TEXT" ]; then
  python3 -c "import pocketsphinx" 2>/dev/null || \
    timeout 180 pip install -q pocketsphinx num2words --break-system-packages >/dev/null 2>&1 || \
    timeout 180 pip install -q pocketsphinx num2words >/dev/null 2>&1 || true
  python3 -c "import num2words" 2>/dev/null || timeout 60 pip install -q num2words --break-system-packages >/dev/null 2>&1 || true
fi

python3 - "$OUT" "$DUR" "$TEXT" <<'PY'
import json, os, re, sys, subprocess
out, dur, text_path = sys.argv[1], float(sys.argv[2]), sys.argv[3]

# ---------- pause map ----------
ev = [l.split(': ') for l in open(os.path.join(out, 'silence.txt')).read().split('\n') if l]
pauses, cur = [], None
for kind, val in ev:
    v = max(0.0, float(val))
    if kind == 'silence_start': cur = v
    elif cur is not None:
        pauses.append({'start': round(cur, 2), 'end': round(v, 2), 'dur': round(v - cur, 2)}); cur = None
if cur is not None:
    pauses.append({'start': round(cur, 2), 'end': round(dur, 2), 'dur': round(dur - cur, 2)})
speech, t = [], 0.0
for p in pauses:
    if p['start'] - t > 0.05: speech.append({'start': round(t, 2), 'end': p['start']})
    t = p['end']
if dur - t > 0.05: speech.append({'start': round(t, 2), 'end': round(dur, 2)})
lead = speech[0]['start'] if speech else 0.0
json.dump(pauses, open(os.path.join(out, 'pauses.json'), 'w'), indent=1)
json.dump(speech, open(os.path.join(out, 'speech.json'), 'w'), indent=1)

# ---------- spoken text -> tokens and clauses ----------
tokens, clauses = [], []
if text_path and os.path.exists(text_path):
    raw = open(text_path, encoding='utf-8').read()
    if text_path.lower().endswith(('.srt', '.vtt')):          # captions export: keep only the words
        raw = '\n'.join(l for l in raw.splitlines()
                        if l.strip() and not re.fullmatch(r'\d+', l.strip()) and '-->' not in l and not l.startswith('WEBVTT'))
        raw = re.sub(r'<[^>]+>', '', raw)
    raw = re.sub(r'[*_`#>]', ' ', raw).replace('—', ' — ').replace('–', ' – ')
    for sent in re.split(r'(?<=[.?!:;])\s+|\n+', raw):
        for cl in re.split(r'(?<=[,—–])\s+', sent.strip()):
            toks = [w for w in cl.split() if re.search(r'[A-Za-z0-9]', w)]
            if not toks: continue
            cid = len(clauses); clauses.append(cl.strip(' —–'))
            for w in toks: tokens.append({'token': w.strip('"“”‘’()[]'), 'clause': cid})

def spoken_forms(tok):
    """Normalise one written token to the words a narrator says."""
    t = tok.lower().replace('’', "'")
    try:
        from num2words import num2words as n2w
    except Exception:
        n2w = None
    pct = t.endswith('%'); t = t.rstrip('%')
    t = t.replace('$', '')
    out_words = []
    for part in re.split(r"[-/]", t):
        part = part.strip(".,;:!?\"'()[]")
        if not part: continue
        num = part.replace(',', '')
        if re.fullmatch(r'\d+(\.\d+)?', num) and n2w:
            n = float(num) if '.' in num else int(num)
            if isinstance(n, int) and 1900 <= n <= 2099 and not pct:
                s = n2w(n, to='year')
            else:
                s = n2w(n)
            out_words += re.findall(r"[a-z']+", s.replace('-', ' '))
        else:
            out_words += [w.strip("'") for w in re.findall(r"[a-z']+", part) if w.strip("'")]
    if pct: out_words.append('percent')
    return out_words

words, method, notes, missing_clauses = [], 'none', [], []
last_speech_end = speech[-1]['end'] if speech else dur

def attach_times(seq, times):
    """times: list of (start,end) per spoken word in seq order; seq: list of token idx."""
    per_tok = {}
    for ti, (s, e) in zip(seq, times):
        if s is None: continue
        a = per_tok.setdefault(ti, [s, e]); a[0] = min(a[0], s); a[1] = max(a[1], e)
    res = []
    for i, tk in enumerate(tokens):
        if i in per_tok:
            res.append({**tk, 'start': round(per_tok[i][0], 2), 'end': round(per_tok[i][1], 2), 'est': False})
        else:
            res.append({**tk, 'start': None, 'end': None, 'est': True})
    # interpolate runs of untimed tokens (dictionary misses, lines missing from the audio)
    i = 0
    while i < len(res):
        if res[i]['start'] is not None: i += 1; continue
        j = i
        while j < len(res) and res[j]['start'] is None: j += 1
        a = res[i - 1]['end'] if i > 0 else lead
        b = res[j]['start'] if j < len(res) else last_speech_end
        b = max(a, b); lens = [len(r['token']) + 1 for r in res[i:j]]; tot = sum(lens); acc = 0
        for r, L in zip(res[i:j], lens):
            r['start'] = round(a + (b - a) * acc / tot, 2); acc += L
            r['end'] = round(a + (b - a) * acc / tot, 2)
        i = j
    return res

# ---------- 1. forced alignment ----------
def split_unknown(w, vocab):
    """Break a dictionary-miss into known pieces: 'openai' -> open + ai, 'replika' -> rep li ka."""
    n = len(w); best = [None] * (n + 1); best[0] = (0, [])
    for i in range(n):
        if best[i] is None: continue
        for j in range(i + 1, n + 1):
            piece = w[i:j]
            if piece in vocab:
                cost = best[i][0] + (3 if len(piece) == 1 else 1)
                if best[j] is None or cost < best[j][0]: best[j] = (cost, best[i][1] + [piece])
    return best[n][1] if best[n] else []

def align(spoken, raw_bytes):
    from pocketsphinx import Decoder
    for kw in ({}, {'beam': 1e-80, 'wbeam': 1e-60, 'pbeam': 1e-80}):
        d = Decoder(samprate=16000, loglevel='FATAL', **kw)
        d.set_align_text(' '.join(spoken))
        d.start_utt(); d.process_raw(raw_bytes, full_utt=True); d.end_utt()
        if d.hyp() is None: continue
        segs = [(s.start_frame / 100, (s.end_frame + 1) / 100) for s in d.seg()
                if not s.word.startswith('<') and not s.word.startswith('[')]
        if len(segs) == len(spoken): return segs
    return None

if tokens:
    try:
        from pocketsphinx import get_model_path
        dictf = os.path.join(get_model_path(), 'en-us', 'cmudict-en-us.dict')
        vocab = set(l.split()[0] for l in open(dictf, encoding='utf-8', errors='ignore'))
        seq, spoken, unknown = [], [], []
        for i, tk in enumerate(tokens):
            forms = []
            for part in re.findall(r'[A-Z]{2,}(?![a-z])|[A-Z]?[a-z\u2019\']+|[A-Z]|\d[\d,.%]*|\S', tk['token']):
                if re.fullmatch(r'[A-Z]{2,6}', part): forms += list(part.lower())      # AI, GPT, CEO -> letters
                else: forms += spoken_forms(part)
            for w in forms:
                if w in vocab: seq.append(i); spoken.append(w)
                else:
                    pieces = split_unknown(w, vocab)
                    if pieces: unknown.append(w); seq += [i] * len(pieces); spoken += pieces
                    else: unknown.append(w + ' (skipped)')
        raw = open(os.path.join(out, 'vo.raw'), 'rb').read()
        times = align(spoken, raw)
        if times is None:
            # Chunked fallback: align clause groups one window at a time, cutting windows inside pauses.
            notes.append('Whole-file alignment failed (the audio and text likely differ somewhere); aligned in chunks instead.')
            times = [None] * len(spoken)
            total_sp = sum(s['end'] - s['start'] for s in speech) or dur
            chars = [len(w) + 1 for w in spoken]; allc = sum(chars)
            def est_time(k):
                x = sum(chars[:k]) / allc * total_sp
                for s in speech:
                    L = s['end'] - s['start']
                    if x <= L: return s['start'] + x
                    x -= L
                return last_speech_end
            cands_all = sorted(set([round((p['start'] + p['end']) / 2, 2) for p in pauses] + [round(dur, 2)]))
            cl_spans = []                                   # (first, last+1) spoken index per clause
            for m, ti in enumerate(seq):
                c = tokens[ti]['clause']
                if cl_spans and cl_spans[-1][0] == c: cl_spans[-1][2] = m + 1
                else: cl_spans.append([c, m, m + 1])
            def try_window(idx, t0, target):
                """Align spoken[idx] starting at t0; try window ends at nearby pauses."""
                sub = [spoken[m] for m in idx]
                for c in sorted([c for c in cands_all if c > t0 + 0.5], key=lambda c: abs(c - target))[:6]:
                    a = int(max(0, t0 - 0.15) * 16000) * 2; b = int(c * 16000) * 2
                    r = align(sub, raw[a:b])
                    if r and sum(e - s for s, e in r) / len(r) >= 0.06:
                        off = a / 32000
                        return [(s + off, e + off) for s, e in r]
                return None
            ci, t0 = 0, lead
            while ci < len(cl_spans):
                cj = ci; n = 0
                while cj < len(cl_spans) and n < 25: n += cl_spans[cj][2] - cl_spans[cj][1]; cj += 1
                group = cl_spans[ci:cj]
                idx = [m for g in group for m in range(g[1], g[2])]
                target = t0 + (est_time(idx[-1] + 1) - est_time(idx[0]))
                r = try_window(idx, t0, target); dropped = None
                if r is None and len(group) > 1:
                    for g in group:                          # is one clause missing from the audio?
                        idx2 = [m for m in idx if not (g[1] <= m < g[2])]
                        r = try_window(idx2, t0, target - (est_time(g[2]) - est_time(g[1])))
                        if r: dropped = g; idx = idx2; break
                if r:
                    for m, se in zip(idx, r): times[m] = se
                    t0 = r[-1][1]
                    if dropped: missing_clauses.append(dropped[0])
                else:
                    notes.append(f'Could not align "{" ".join(spoken[idx[0]:idx[0]+6])} ..." — times estimated.')
                    t0 = target
                ci = cj
            times = [t if t is not None else (None, None) for t in times]
        words = attach_times(seq, times)
        method = 'forced-alignment (pocketsphinx)'
        if unknown: notes.append('Split into sound-alike pieces for the aligner: ' + ', '.join(sorted(set(unknown))[:20]))
        drift = abs(words[-1]['end'] - last_speech_end)
        if drift > 1.5:
            notes.append(f'Aligned text ends at {words[-1]["end"]:.2f}s but speech ends at {last_speech_end:.2f}s. '
                         'The text and audio probably differ (spoken headings, cut lines, ad-libs). '
                         'Fix the spoken-text file, or split the audio and align each part.')
    except Exception as ex:
        notes.append(f'Forced alignment unavailable ({type(ex).__name__}: {ex}); using another method.')
        words = []

# ---------- 2. whisper (no text given) ----------
if not words and not tokens:
    try:
        r = subprocess.run(['timeout', '300', 'python3', '-c', '''
import json,sys
from faster_whisper import WhisperModel
m=WhisperModel("tiny.en",device="cpu",compute_type="int8")
segs,_=m.transcribe(sys.argv[1],word_timestamps=True)
print(json.dumps([{"token":w.word.strip(),"start":round(w.start,2),"end":round(w.end,2),"clause":i,"est":False} for i,s in enumerate(segs) for w in s.words]))
''', os.path.join(out, 'vo16k.wav')], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            words = json.loads(r.stdout); method = 'whisper (faster-whisper tiny.en)'
        else:
            notes.append('Whisper unavailable (not installed or model download blocked). Pause map only: ask the user for the script or a captions file (.srt/.vtt from CapCut, Premiere, YouTube) and rerun with it.')
    except Exception as ex:
        notes.append(f'Whisper unavailable ({ex}). Pause map only.')

# ---------- 3. proportional estimate ----------
if not words and tokens:
    total = sum(s['end'] - s['start'] for s in speech) or dur
    lens = [len(tk['token']) + 1 for tk in tokens]; allc = sum(lens); acc = 0
    def at(frac):
        x = frac * total
        for s in speech:
            L = s['end'] - s['start']
            if x <= L: return s['start'] + x
            x -= L
        return last_speech_end
    words = []
    for tk, L in zip(tokens, lens):
        words.append({**tk, 'start': round(at(acc / allc), 2), 'end': round(at((acc + L) / allc), 2), 'est': True}); acc += L
    method = 'estimate (characters spread over speech segments)'

# ---------- mismatch flags ----------
flags = [f'"{clauses[c][:70]}" — not found in the audio (skipped or reworded?)' for c in missing_clauses]
if method.startswith('forced'):
    for cid, cl in enumerate(clauses):
        ws = [w for w in words if w['clause'] == cid and not w['est']]
        if len(ws) >= 3:
            avg = sum(w['end'] - w['start'] for w in ws) / len(ws)
            if avg < 0.07: flags.append(f'"{cl[:70]}" — squeezed to {avg*1000:.0f} ms per word: may not be in the audio')
        for w in ws[:-1]:
            if w['end'] - w['start'] > 1.6:
                flags.append(f'"{cl[:70]}" — the word "{w["token"]}" stretches {w["end"]-w["start"]:.1f}s: extra or reworded speech nearby')
                break

json.dump({'method': method, 'duration': dur, 'leading_silence': lead, 'words': words}, open(os.path.join(out, 'words.json'), 'w'), indent=1)

# ---------- clause lines ----------
lines = []
for cid, cl in enumerate(clauses):
    ws = [w for w in words if w.get('clause') == cid]
    if ws: lines.append(f"{ws[0]['start']:7.2f}-{ws[-1]['end']:7.2f}  {cl}")
if not clauses and words:
    buf, st = [], None
    for w in words:
        st = w['start'] if st is None else st; buf.append(w['token'])
        if re.search(r'[.?!,]$', w['token']) or len(buf) > 12:
            lines.append(f"{st:7.2f}-{w['end']:7.2f}  {' '.join(buf)}"); buf, st = [], None
    if buf: lines.append(f"{st:7.2f}-{words[-1]['end']:7.2f}  {' '.join(buf)}")
open(os.path.join(out, 'lines.txt'), 'w').write('\n'.join(lines) + '\n')

# ---------- report ----------
R = []
R.append(f'Duration: {dur:.2f}s   Leading silence: {lead:.2f}s   Speech ends: {last_speech_end:.2f}s')
R.append(f'Word timing method: {method}')
R.append(f'Pauses (>= {os.environ.get("MIN_PAUSE","0.35")}s, best clip cut points):')
R.append('  ' + '  '.join(f"{p['start']:.2f}-{p['end']:.2f}" for p in pauses))
R.append(f'Speech segments: {len(speech)}')
if lines: R += ['', 'Timed clauses:'] + lines
if flags: R += ['', 'Possible script/audio mismatches:'] + ['  - ' + f for f in flags]
if notes: R += ['', 'Notes:'] + ['  - ' + n for n in notes]
open(os.path.join(out, 'report.txt'), 'w').write('\n'.join(R) + '\n')
print('\n'.join(R))
PY
rm -f "$OUT/vo.raw" "$OUT/silence.txt"
