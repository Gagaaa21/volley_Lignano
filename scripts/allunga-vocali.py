"""Allunga le vocali di un grido già chiaro, «MONSTER BLOCK!» -> «MOOONSTEEEER BLOOOOOCK!», per il Monster block della
pulsantiera. Scritto così nel testo il modello di voce si confonde; e rallentare la vocale vera non va bene, perché la sua
melodia scende e allungata sembra uno che precipita. Qui, con il vocoder WORLD (pip install pyworld librosa soundfile), si
allunga la vocale e la melodia si disegna da speaker: MOOON tiene la nota, STEEEER sale un poco (e sta più vicina a MOOON),
BLOOOOOCK sale ancora e resta in alto con un vibrato leggero; il volume cresce dentro ogni vocale; le consonanti restano com'erano.
Uso: python allunga-vocali.py <presa.wav> <inizio s> <fine s> <uscita.wav> [fattori 3.2,3.6,4.6] [salite 0.5,1.5,2.5]
     [spostamenti in semitoni 0,2.5,1.5]
Il Monster block: presa Chatterbox «MONSTER BLOCK!!! MONSTER BLOCK!!!» (vedi monster-block-arena.py), da 0 a 1,3 s, valori di serie.
"""
import sys
import numpy as np
import librosa
import pyworld as pw
import soundfile as sf

SR = 24000
FP = 5.0  # ms per frame
src, start, end, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
factors = [float(x) for x in (sys.argv[5] if len(sys.argv) > 5 else "3.2,3.6,4.6").split(",")]
rises = [float(x) for x in (sys.argv[6] if len(sys.argv) > 6 else "0.5,1.5,2.5").split(",")]
# Di quanto spostare la nota di ogni vocale (semitoni): STEEER un po' più su, così la frase non fa un tuffo e culmina su BLOCK.
offsets = [float(x) for x in (sys.argv[7] if len(sys.argv) > 7 else "0,2.5,1.5").split(",")]

y, _ = librosa.load(src, sr=SR)
x = y[int(start * SR) : int(end * SR)].astype(np.float64)
f0, t = pw.harvest(x, SR, f0_floor=90.0, f0_ceil=900.0, frame_period=FP)
f0 = pw.stonemask(x, f0, t, SR)
sp = pw.cheaptrick(x, f0, t, SR)
ap = pw.d4c(x, f0, t, SR)
nfr = len(f0)
energy = np.log(np.sum(sp, axis=1) + 1e-12)
loud = energy > (energy.max() - 6.0)

# Le vocali: tratti intonati e forti di almeno 50 ms (le prime tre: MON, STER, BLOCK).
vow = (f0 > 0) & loud
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

new_f0, new_sp, new_ap, gain = [], [], [], []
cursor = 0
edge = 6  # 30 ms lasciati come sono a inizio e fine vocale (attacco e passaggio alla consonante)
for k, (a, b) in enumerate(runs):
    ca, cb = a + edge, max(a + edge + 2, b - edge)
    for fr in range(cursor, ca):
        new_f0.append(f0[fr]); new_sp.append(sp[fr]); new_ap.append(ap[fr]); gain.append(1.0)
    # Il cuore della vocale, allungato: si interpolano timbro e rumore, il tono si disegna.
    fac = factors[min(k, len(factors) - 1)]
    rise = rises[min(k, len(rises) - 1)]
    m = int(round((cb - ca) * fac))
    voiced = f0[ca:cb][f0[ca:cb] > 0]
    base = (float(np.percentile(voiced, 80)) if len(voiced) else 400.0) * 2 ** (offsets[min(k, len(offsets) - 1)] / 12)
    start_f0 = f0[ca] if f0[ca] > 0 else base
    for q in range(m):
        pos = ca + (cb - ca - 1) * q / max(1, m - 1)
        lo = int(np.floor(pos)); hi = min(lo + 1, cb - 1); w = pos - lo
        new_sp.append(np.exp((1 - w) * np.log(sp[lo] + 1e-12) + w * np.log(sp[hi] + 1e-12)))
        new_ap.append((1 - w) * ap[lo] + w * ap[hi])
        u = q / max(1, m - 1)
        # Dal tono d'attacco si arriva in 80 ms alla nota alta della vocale, poi si sale piano di `rise` semitoni.
        glide = min(1.0, q * FP / 80.0)
        target = base * 2 ** (rise * u / 12)
        f = start_f0 * (1 - glide) + target * glide
        vib_amt = 0.25 * min(1.0, max(0.0, (q * FP - 150) / 150))  # vibrato dopo 150 ms, ±0,25 semitoni
        f *= 2 ** (vib_amt * np.sin(2 * np.pi * 5.5 * q * FP / 1000) / 12)
        new_f0.append(f)
        gain.append(10 ** ((-2.0 + 4.0 * u) / 20))  # crescendo: da -2 a +2 dB dentro la vocale
    # Il passaggio verso la consonante: tono agganciato alla fine della vocale allungata.
    last = new_f0[-1]
    for fr in range(cb, b):
        orig = f0[fr]
        new_f0.append(last if orig > 0 else 0.0); new_sp.append(sp[fr]); new_ap.append(ap[fr]); gain.append(1.0)
    cursor = b
for fr in range(cursor, nfr):
    new_f0.append(f0[fr]); new_sp.append(sp[fr]); new_ap.append(ap[fr]); gain.append(1.0)

nf0 = np.ascontiguousarray(np.array(new_f0, dtype=np.float64))
nsp = np.ascontiguousarray(np.array(new_sp, dtype=np.float64))
nap = np.ascontiguousarray(np.array(new_ap, dtype=np.float64))
yout = pw.synthesize(nf0, nsp, nap, SR, frame_period=FP)
g = np.repeat(np.array(gain), int(SR * FP / 1000))
g = np.convolve(np.pad(g, (0, max(0, len(yout) - len(g))), mode="edge")[: len(yout)], np.ones(240) / 240, mode="same")
yout = yout * g
sf.write(out, yout / np.max(np.abs(yout)) * 0.95, SR)
print(out, round(len(yout) / SR, 2), "s")
