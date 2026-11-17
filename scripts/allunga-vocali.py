"""Allunga le vocali di un grido già chiaro: «MONSTER BLOCK!» -> «MOOONSTEEEER BLOOOOOCK!» (per il Monster block della
pulsantiera). Scritto così nel testo, il modello di voce si confonde; allungando le vocali a mano invece la parola resta chiara.
Trova le parti con la voce intonata (le vocali) dentro ogni sillaba e le rallenta senza cambiare il tono (rubberband), lasciando
com'erano le consonanti. Uso (con librosa e soundfile):
    python allunga-vocali.py <presa.wav> <inizio s> <fine s> <uscita.wav> [fattori, es. 3.2,3.6,4.6]
Il Monster block: presa Chatterbox «MONSTER BLOCK!!! MONSTER BLOCK!!!» (vedi monster-block-arena.py), da 0 a 1,3 s, 3.2,3.6,4.6.
"""
import subprocess, sys
import numpy as np
import librosa
import soundfile as sf

SR = 24000
src, start, end, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
y, _ = librosa.load(src, sr=SR)
y = y[int(start * SR) : int(end * SR)]
hop = 120
f0, voiced, _ = librosa.pyin(y, fmin=80, fmax=700, sr=SR, hop_length=hop, frame_length=1024)
rms = librosa.feature.rms(y=y, hop_length=hop, frame_length=1024)[0]
n = min(len(voiced), len(rms))
loud = rms[:n] > 0.12 * rms.max()
vow = voiced[:n] & loud

# Le vocali: tratti intonati di almeno 50 ms. Si allungano solo i primi tre (MON, STER, BLOCK), di più l'ultimo.
runs = []
i = 0
while i < n:
    if vow[i]:
        j = i
        while j < n and vow[j]: j += 1
        if (j - i) * hop / SR >= 0.05: runs.append((i * hop, j * hop))
        i = j
    else:
        i += 1
factors = [float(x) for x in (sys.argv[5] if len(sys.argv) > 5 else "2.4,2.6,3.2").split(",")]  # quanto più lunga ogni vocale
print("vocali trovate (s):", [(round(a / SR, 2), round(b / SR, 2)) for a, b in runs])


def stretch(seg, factor):
    sf.write("tmp/seg_in.wav", seg, SR)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", "tmp/seg_in.wav", "-af", f"rubberband=tempo={1 / factor}:pitch=1:formant=preserved", "tmp/seg_out.wav"], check=True)
    z, _ = sf.read("tmp/seg_out.wav")
    return z.astype(np.float64)


parts, cursor = [], 0
for k, (a, b) in enumerate(runs[:3]):
    # Si lascia intatto l'ultimo pezzetto della vocale (passaggio verso la consonante).
    keep = int(0.03 * SR)
    core_a, core_b = a + keep, max(a + keep + 1, b - keep)
    parts.append(y[cursor:core_a])
    parts.append(stretch(y[core_a:core_b], factors[min(k, len(factors) - 1)]))
    cursor = core_b
parts.append(y[cursor:])
# Unione con dissolvenze brevissime, per non sentire le cuciture.
xf = int(0.008 * SR)
res = parts[0]
for p in parts[1:]:
    if len(res) > xf and len(p) > xf:
        fade = np.linspace(0, 1, xf)
        res = np.concatenate([res[:-xf], res[-xf:] * (1 - fade) + p[:xf] * fade, p[xf:]])
    else:
        res = np.concatenate([res, p])
sf.write(out, res / np.max(np.abs(res)) * 0.95, SR)
print(out, round(len(res) / SR, 2), "s")
