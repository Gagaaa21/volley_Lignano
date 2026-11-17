"""Rifà il suono del Monster block della pulsantiera (public/diretta/suoni/monsterBlock.mp3, versione «A»).

Versione «carica»: 174 bpm, Mi maggiore, voce robotica che non viene abbassata (niente suono cupo), raddoppiata un'ottava sotto
per il «mostro», ripetuta a scatti (MON-MON-MONSTER BLOCK!), trombetta da stadio, cassa dritta, rullata, riff di synth e accordo
finale con la folla. Musica tutta originale, sintetizzata qui; non è una copia del Monster block della SuperLega / LVF.

Come si rifà (stessa cartella di lavoro di scripts/suoni-pulsantiera.py, copiato lì come mix.py, con le voci piper in raw/):
    gen(){ echo "$3" | python3 -m piper -m models/$1.onnx -f raw/$2.wav --length-scale $4 --noise-scale 0.8 --noise-w-scale 0.9; }
    gen en_US-bryce-medium monster_bryce "Monster block!" 1.05
    gen en_US-bryce-medium mb_bryce_fast "Monster block!" 0.9
    gen en_US-joe-medium block_joe "Block!" 0.9
    python3 monster-block.py A        # -> out/monsterBlock_A.wav, poi -14 LUFS e mp3 come in suoni-pulsantiera.py
Rifatto il file, alzare DEFAULT_SOUNDS_VERSION in src/lib/diretta/cues.ts.
"""
import subprocess, sys
import numpy as np
from mix import SR, RNG, boom, clap, crash, env_exp, hp, load, onepole_lp, place, save, snare, t

BPM = 174
BEAT = 60 / BPM
E8 = BEAT / 2


def hz(note):
    """Nota MIDI -> Hz."""
    return 440 * 2 ** ((note - 69) / 12)


def voice(name, start, end, pitch=1.0, tempo=1.0):
    out = f"tmp/v3_{name}_{pitch}_{tempo}.wav"
    af = f"atrim={start}:{end},asetpts=N/SR/TB,aresample={SR},rubberband=pitch={pitch}:tempo={tempo}:formant=preserved:transients=crisp"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"raw/{name}.wav", "-af", af, "-ac", "1", "-ar", str(SR), out], check=True)
    x = load(out)
    f = int(SR * 0.008)
    x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x / np.max(np.abs(x))


def octave_down(name, start, end, tempo):
    """Lo stesso grido un'ottava sotto: lo spessore del «mostro», da mettere sotto piano."""
    return voice(name, start, end, pitch=0.5, tempo=tempo)


def hype(v, low=None, gain=1.0):
    """Voce da speaker carico: presenza alta, un po' di saturazione, il mostro sotto, eco corta e chiara (non da cantina)."""
    y = hp(v, 140)
    if low is not None:
        n = min(len(y), len(low)); y = y.copy(); y[:n] += onepole_lp(hp(low[:n], 70), 1200) * 0.3
    y = y + hp(y, 2500) * 1.1  # brillantezza: la «k» di BLOCK vive lassù
    y = np.tanh(1.5 * y) / np.tanh(1.5)
    out = np.concatenate([y, np.zeros(int(SR * 0.5))])
    for d, g in ((0.09, 0.28), (0.18, 0.14), (0.27, 0.07)):
        i = int(d * SR)
        out[i : i + len(y)] += onepole_lp(y, 5000) * g
    return out * gain


def kick(amp=0.9):
    n = int(SR * 0.32); tt = t(n)
    f = 48 + 130 * np.exp(-tt / 0.03)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.11)
    click = hp(RNG.standard_normal(n), 2000) * env_exp(n, 0.003) * 0.6
    return np.tanh(2.0 * (body + click)) * amp


def hat(amp=0.18, open_=False):
    n = int(SR * (0.18 if open_ else 0.05))
    return hp(hp(RNG.standard_normal(n), 7000), 7000) * env_exp(n, 0.06 if open_ else 0.012) * amp


def saw(freq, n, detune=0.0):
    ph = (t(n) * freq * (1 + detune) + RNG.uniform(0, 1)) % 1.0
    return 2 * ph - 1


def lead(notes, dur, amp=0.32, cutoff=6500):
    """Synth brillante (seghe stonate di poco), per il riff."""
    n = int(SR * dur); x = np.zeros(n)
    for f in notes:
        for d in (-0.008, 0.0, 0.009):
            x += saw(f, n, d)
    x /= len(notes) * 3
    a = np.minimum(1, t(n) / 0.006); r = np.clip((dur - t(n)) / 0.03, 0, 1)
    y = onepole_lp(x, cutoff)
    return np.tanh(1.8 * y) * a * r * amp


def bass(freq, dur, amp=0.45):
    n = int(SR * dur)
    x = saw(freq, n) * 0.6 + np.sin(2 * np.pi * freq * t(n))
    y = onepole_lp(x, 900) * np.minimum(1, t(n) / 0.004) * np.clip((dur - t(n)) / 0.02, 0, 1)
    return np.tanh(1.5 * y) * amp


def airhorn(dur=0.5, amp=0.42, base=hz(70)):
    """La trombetta da stadio: accordo di seghe con un attacco che scende un filo di tono, filtrato e saturato."""
    n = int(SR * dur); tt = t(n)
    bend = 1 + 0.05 * np.exp(-tt / 0.04)
    x = np.zeros(n)
    for ratio in (1.0, 1.26, 1.5):
        f = base * ratio * bend
        for d in (-0.01, 0.0, 0.012):
            x += 2 * ((np.cumsum(f * (1 + d)) / SR + RNG.uniform(0, 1)) % 1.0) - 1
    x /= 9
    y = onepole_lp(hp(x, 300), 3200)
    env = np.minimum(1, tt / 0.012) * np.clip((dur - tt) / 0.05, 0, 1)
    return np.tanh(3.0 * y) * env * amp


def riser(dur, amp=0.25):
    n = int(SR * dur); tt = t(n)
    x = hp(onepole_lp(RNG.standard_normal(n), 300 + 7000 * (tt / dur) ** 2), 400)
    sweep = np.sin(2 * np.pi * np.cumsum(200 + 1400 * (tt / dur) ** 2) / SR) * 0.3
    return (x + sweep) * (tt / dur) ** 1.6 * amp


def roar(dur, amp=0.2, at=0.0):
    """La folla che esplode: rumore «a bocca aperta» che sale e resta, con tanti fischi qua e là."""
    n = int(SR * dur); tt = t(n)
    x = hp(onepole_lp(RNG.standard_normal(n), 2600), 350)
    x = x / np.max(np.abs(x))
    whistle = np.zeros(n)
    for k in range(6):
        s = int(RNG.uniform(0.1, 0.7) * n); m = int(SR * RNG.uniform(0.15, 0.35)); m = min(m, n - s)
        f = RNG.uniform(1800, 3000) * (1 + 0.03 * np.sin(2 * np.pi * 7 * t(m)))
        whistle[s : s + m] += np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t(m) / (m / SR)) * 0.08
    env = np.clip((tt - at) / 0.35, 0, 1) * np.clip((dur - tt) / 0.5, 0, 1)
    return (x + whistle) * env * amp


def master(music, vox, name):
    venv = np.sqrt(onepole_lp(vox ** 2, 10) + 1e-12); venv /= np.max(venv)
    buf = music * (1 - 0.45 * np.clip(venv * 2.5, 0, 1)) + vox * 1.1
    buf = hp(buf, 30)
    buf = np.tanh(1.4 * buf / np.max(np.abs(buf))) / np.tanh(1.4)
    fade = int(SR * 0.3); buf[-fade:] *= np.linspace(1, 0, fade) ** 2
    save(f"out/{name}.wav", buf * 0.85 / np.max(np.abs(buf)))
    print(name, round(len(buf) / SR, 2), "s")


# Mi maggiore: E, G#, B. Riff originale (non preso da nessuna sigla).
E4, Gs4, B4, Cs5, E5, Fs5, Gs5, B5 = (hz(n) for n in (64, 68, 71, 73, 76, 78, 80, 83))
E2, B1, Cs2, A1 = hz(40), hz(35), hz(37), hz(33)


def build(variant):
    dur = 3.7
    music = np.zeros(int(SR * (dur + 0.6))); vox = np.zeros_like(music)
    tempo = 1.06
    v = voice("monster_bryce", 0.03, 0.98, pitch=0.97, tempo=1.1)
    low = octave_down("monster_bryce", 0.03, 0.98, 1.1)
    vb = voice("mb_bryce_fast", 0.03, 0.95, pitch=1.0, tempo=tempo)
    lowb = octave_down("mb_bryce_fast", 0.03, 0.95, tempo)

    # 0: botta d'entrata, trombetta, piatto.
    place(music, kick(1.0), 0.0); place(music, boom(0.6, 190, 40, 0.8), 0.0)
    place(music, crash(1.6, 0.3), 0.0)
    place(music, airhorn(0.42, 0.42), 0.0)
    # Il primo grido.
    place(vox, hype(v, low, 0.95), 0.12)
    # Groove: cassa dritta, battimani sul 2 e 4, charleston, basso in ottavi.
    groove_end = 2.05
    k = 0
    while k * BEAT < groove_end:
        at = k * BEAT
        if k > 0: place(music, kick(0.8), at)
        if k % 2 == 1: place(music, clap(0.42), at); place(music, snare(0.2, 0.22), at)
        place(music, hat(0.14), at + E8)
        k += 1
    line = [E2, E2, E2, E2, Cs2, Cs2, A1, B1, E2, E2, E2, E2]
    for i, f in enumerate(line):
        if i * E8 + E8 < groove_end: place(music, bass(f, E8 * 0.9, 0.4), i * E8)
    # Lo «scatto»: MON-MON-MONSTER BLOCK! (la seconda voce, più forte), con la salita sotto.
    s0 = 0.98
    chop = vb[: int(0.13 * SR)].copy(); chop[-int(0.01 * SR):] *= np.linspace(1, 0, int(0.01 * SR))
    if variant == "A":
        place(vox, hype(chop, lowb[: len(chop)], 0.85), s0)
        place(vox, hype(chop, lowb[: len(chop)], 0.9), s0 + E8)
        place(vox, hype(vb, lowb, 1.05), s0 + 2 * E8)
        place(music, riser(2 * E8 + 0.55, 0.22), s0)
    else:
        # B: niente scatti, il secondo grido con la folla che risponde «BLOCK!».
        place(vox, hype(vb, lowb, 1.05), s0 + 0.12)
        blk = voice("block_joe", 0.2, 0.46, pitch=0.9, tempo=1.0)
        place(vox, hype(blk, None, 0.7) * 0.8, s0 + 0.95)
        place(music, riser(0.9, 0.22), s0)
    # Rullata che accelera prima dell'esplosione (sedicesimi, poi trentaduesimi), sempre più forte.
    r0 = 2.08
    at, k = 1.56, 0
    while at < r0 - 0.01:
        step = E8 / 2 if at < 1.84 else E8 / 4
        place(music, snare(0.12, 0.12 + 0.3 * (at - 1.56) / (r0 - 1.56)), at)
        at += step; k += 1
    # Charleston in sedicesimi sotto il secondo grido: più movimento.
    at = 0.98
    while at < 1.56:
        place(music, hat(0.1), at); at += E8 / 2
    # Il riff che sale e l'esplosione finale.
    for i, f in enumerate((E5, Gs5, B5)):
        place(music, lead([f, f / 2], E8 * 0.85, 0.3), r0 + i * E8 * 0.5)
    hit = r0 + 1.5 * E8
    place(music, kick(1.0), hit); place(music, boom(0.9, 200, 36, 0.95), hit)
    place(music, crash(1.8, 0.36), hit)
    place(music, lead([E4, Gs4, B4, E5, Gs5], 1.05, 0.36, cutoff=7500), hit)
    place(music, bass(E2, 1.0, 0.45), hit)
    place(music, airhorn(0.55, 0.38), hit + 0.02)
    place(music, airhorn(0.35, 0.3, base=hz(72)), hit + 0.62)
    place(music, roar(dur - 0.6, 0.2, at=0.9), 0.6)
    n = int(SR * dur)
    master(music[:n], vox[:n], f"monsterBlock_{variant}")


if __name__ == "__main__":
    for v in sys.argv[1:] or ["A", "B"]:
        build(v)
