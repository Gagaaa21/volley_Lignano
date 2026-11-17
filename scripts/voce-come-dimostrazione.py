"""Dà a un grido chiaro della voce sintetica («MONSTER BLOCK!», vedi monster-block-arena.py) il modo di dirlo della
dimostrazione registrata dal proprietario: durata di ogni vocale, melodia (semitoni rispetto a una nota di riferimento) e
volume, misurati su quella registrazione (pyin di librosa, 10 ms) e scritti qui sotto in SHAPE. Della registrazione non si usa
nessun pezzo e la voce resta quella sintetica. Vocoder WORLD (pip install pyworld librosa soundfile): ogni vocale si allunga o
si accorcia e la melodia si disegna; le consonanti restano com'erano.
Uso: python voce-come-dimostrazione.py <presa.wav> <inizio s> <fine s> <uscita.wav> [nota di riferimento Hz, 300]
Il Monster block: presa da 0 a 1,3 s, riferimento 300 Hz; poi monster-block-rock.py.
"""
import sys
import numpy as np
import librosa
import pyworld as pw
import soundfile as sf

SR = 24000
FP = 5.0
src, start, end, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
REF = float(sys.argv[5]) if len(sys.argv) > 5 else 320.0

# Dalla dimostrazione: (durata della vocale in s, melodia [(frazione, semitoni)], volume [(frazione, dB)]).
SHAPE = [
    # MON: corta, parte bassa e sale.
    (0.40, [(0, -5.7), (0.4, -4.9), (0.6, -3.4), (0.8, -2.0), (1, -1.3)], [(0, -3), (0.2, 0), (1, -2)]),
    # STEEEER: la vocale lunga, sale piano e tiene.
    (0.98, [(0, -4.3), (0.15, -3.6), (0.3, -1.6), (0.45, -0.4), (0.6, 0.6), (0.75, 1.5), (0.85, 2.0), (1, 2.0)], [(0, 0), (0.2, -2), (1, -3)]),
    # BLOOOCK: salta in alto, picco subito, poi ricade fino alla CK.
    (0.67, [(0, 4.2), (0.12, 6.5), (0.22, 8.4), (0.4, 7.1), (0.55, 5.2), (0.7, 4.0), (0.85, 0.4), (1, -2.3)], [(0, 0), (0.2, -1), (1, -7)]),
]


def interp(points, u):
    xs, ys = zip(*points)
    return float(np.interp(u, xs, ys))


y, _ = librosa.load(src, sr=SR)
x = y[int(start * SR) : int(end * SR)].astype(np.float64)
f0, t = pw.harvest(x, SR, f0_floor=90.0, f0_ceil=900.0, frame_period=FP)
f0 = pw.stonemask(x, f0, t, SR)
sp = pw.cheaptrick(x, f0, t, SR)
ap = pw.d4c(x, f0, t, SR)
nfr = len(f0)
energy = np.log(np.sum(sp, axis=1) + 1e-12)
vow = (f0 > 0) & (energy > energy.max() - 6.0)
runs, i = [], 0
while i < nfr:
    if vow[i]:
        j = i
        while j < nfr and vow[j]: j += 1
        if (j - i) * FP >= 50: runs.append((i, j))
        i = j
    else:
        i += 1
runs = runs[:3]
print("vocali (s):", [(round(a * FP / 1000, 2), round(b * FP / 1000, 2)) for a, b in runs])

nf0, nsp, nap, gain = [], [], [], []
cursor = 0
for k, (a, b) in enumerate(runs):
    for fr in range(cursor, a):
        # Consonanti e passaggi: tono originale, ma riportato vicino alla nota di partenza della vocale che segue.
        nf0.append(f0[fr] * 0 + (REF * 2 ** (SHAPE[k][1][0][1] / 12) if f0[fr] > 0 else 0.0))
        nsp.append(sp[fr]); nap.append(ap[fr]); gain.append(1.0)
    dur, pitch, vol = SHAPE[k]
    m = max(2, int(round(dur * 1000 / FP)))
    for q in range(m):
        pos = a + (b - a - 1) * q / (m - 1)
        lo = int(np.floor(pos)); hi = min(lo + 1, b - 1); w = pos - lo
        nsp.append(np.exp((1 - w) * np.log(sp[lo] + 1e-12) + w * np.log(sp[hi] + 1e-12)))
        nap.append((1 - w) * ap[lo] + w * ap[hi])
        u = q / (m - 1)
        nf0.append(REF * 2 ** (interp(pitch, u) / 12))
        gain.append(10 ** (interp(vol, u) / 20))
    cursor = b
last = nf0[-1] if nf0 else REF
for fr in range(cursor, nfr):
    nf0.append(last if f0[fr] > 0 else 0.0); nsp.append(sp[fr]); nap.append(ap[fr]); gain.append(1.0)

yout = pw.synthesize(np.ascontiguousarray(nf0, dtype=np.float64), np.ascontiguousarray(nsp, dtype=np.float64),
                     np.ascontiguousarray(nap, dtype=np.float64), SR, frame_period=FP)
g = np.repeat(np.array(gain), int(SR * FP / 1000))
g = np.pad(g, (0, max(0, len(yout) - len(g))), mode="edge")[: len(yout)]
g = np.convolve(g, np.ones(240) / 240, mode="same")
yout = yout * g
sf.write(out, yout / np.max(np.abs(yout)) * 0.95, SR)
print(out, round(len(yout) / SR, 2), "s")
