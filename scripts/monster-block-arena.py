"""Rifà il suono del Monster block della pulsantiera (public/diretta/suoni/monsterBlock.mp3): uno speaker da arena americana
che urla «MONSTER BLOCK! MONSTER BLOCK!» con l'eco grande del palazzetto, sopra la musica originale di monster-block.py
(174 bpm, Mi maggiore) che si allunga o si accorcia sul grido.

La voce è sintetica: Chatterbox (Resemble AI, licenza MIT, pip install chatterbox-tts) con l'enfasi al massimo, partendo da
una voce maschile anch'essa sintetica (Kokoro, Apache 2.0, voce «am_fenrir»): non imita nessuna persona vera.
    ref = Kokoro am_fenrir, «Ladies and gentlemen, welcome to the arena! What a match we have tonight! ...»
    ChatterboxTTS.generate("MONSTER BLOCK!!! MONSTER BLOCK!!!", audio_prompt_path=ref, exaggeration=2.0, cfg_weight=0.2,
                           temperature=0.85)  con torch.manual_seed(2)
Poi:  python3 monster-block-arena.py presa.wav monsterBlock   (cartella di lavoro come suoni-pulsantiera.py: mix.py e
mix3.py = monster-block.py accanto), -14 LUFS e mp3 mono 96 kbit/s. Rifatto il file, alzare DEFAULT_SOUNDS_VERSION.
"""
import subprocess, sys
import numpy as np
from mix import SR, RNG, boom, clap, crash, env_exp, hp, load, onepole_lp, place, save, snare
from mix3 import BEAT, E8, E2, A1, B1, Cs2, E4, Gs4, B4, E5, Gs5, B5, airhorn, bass, hat, hz, kick, lead, roar


def take(path):
    out = "tmp/us_take.wav"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), out], check=True)
    x = load(out)
    env = np.sqrt(onepole_lp(x ** 2, 30))
    act = env > 0.05 * env.max()
    on = np.where(act)[0]
    x = x[max(0, on[0] - int(0.02 * SR)):]
    act = act[max(0, on[0] - int(0.02 * SR)):]
    # Fine della frase: dopo una pausa di più di 0,6 s c'è solo rumore o parole inventate.
    run, end = 0, len(x)
    for i in range(len(act)):
        run = 0 if act[i] else run + 1
        if run == int(0.6 * SR):
            end = i - run + int(0.12 * SR); break
    x = x[:end]
    last = np.where(act[:end])[0][-1]
    x = x[: min(len(x), last + int(0.12 * SR))]
    f = int(0.01 * SR); x[-f:] *= np.linspace(1, 0, f)
    return x / np.max(np.abs(x))


def arena(v, wet=0.32):
    """Lo speaker nel palazzetto americano: voce piena e presente, compressa, l'eco del ritardo dell'impianto e la coda lunga
    della sala (più di un secondo e mezzo)."""
    y = hp(v, 100)
    y = y + hp(y, 3000) * 0.5
    y = np.tanh(1.6 * y) / np.tanh(1.6)
    out = np.concatenate([y, np.zeros(int(SR * 1.8))])
    i = int(0.13 * SR); out[i : i + len(y)] += onepole_lp(y, 4000) * 0.22
    n = int(SR * 1.7)
    ir = RNG.standard_normal(n) * env_exp(n, 0.42)
    ir[: int(0.04 * SR)] = 0  # pre-ritardo
    ir = onepole_lp(ir, 4200); ir /= np.sqrt(np.sum(ir ** 2))
    rev = np.convolve(y, ir)[: len(out)]
    out[: len(rev)] += rev * wet
    return out


def build(path, name):
    v = take(path)
    vlen = len(v) / SR
    vs = 0.12
    hit = vs + vlen + 0.02
    total = hit + 1.35
    music = np.zeros(int(SR * (total + 0.5))); vox = np.zeros_like(music)
    place(music, kick(1.0), 0.0); place(music, boom(0.6, 190, 40, 0.8), 0.0)
    place(music, crash(1.6, 0.28), 0.0)
    place(music, airhorn(0.4, 0.38), 0.0)
    place(vox, arena(v), vs)
    # Groove sotto il grido, fino a mezzo secondo prima della botta; poi la rullata che accelera.
    roll = max(vs + 0.3, hit - 0.5)
    k = 1
    while k * BEAT < roll:
        at = k * BEAT
        place(music, kick(0.75), at)
        if k % 2 == 1: place(music, clap(0.38), at)
        place(music, hat(0.12), at + E8)
        k += 1
    line = [E2, E2, E2, E2, Cs2, Cs2, A1, B1]
    i = 0
    while i * E8 + E8 < roll:
        place(music, bass(line[i % len(line)], E8 * 0.9, 0.36), i * E8); i += 1
    at = roll
    while at < hit - 0.01:
        step = E8 / 2 if at < hit - 0.25 else E8 / 4
        place(music, snare(0.12, 0.14 + 0.3 * (at - roll) / max(0.01, hit - roll)), at)
        at += step
    for j, f in enumerate((E5, Gs5, B5)):
        place(music, lead([f, f / 2], E8 * 0.8, 0.28), hit - 0.26 + j * E8 * 0.5)
    place(music, kick(1.0), hit); place(music, boom(0.9, 200, 36, 0.95), hit)
    place(music, crash(1.8, 0.36), hit)
    place(music, lead([E4, Gs4, B4, E5, Gs5], 1.05, 0.34, cutoff=7500), hit)
    place(music, bass(E2, 1.0, 0.42), hit)
    place(music, airhorn(0.5, 0.36), hit + 0.02)
    place(music, roar(total - 0.4, 0.22, at=hit - 0.4), 0.4)
    n = int(SR * total)
    venv = np.sqrt(onepole_lp(vox[:n] ** 2, 10) + 1e-12); venv /= np.max(venv)
    buf = music[:n] * (1 - 0.5 * np.clip(venv * 2.5, 0, 1)) + vox[:n] * 1.15
    buf = hp(buf, 30)
    buf = np.tanh(1.3 * buf / np.max(np.abs(buf))) / np.tanh(1.3)
    fade = int(SR * 0.35); buf[-fade:] *= np.linspace(1, 0, fade) ** 2
    save(f"out/{name}.wav", buf * 0.85 / np.max(np.abs(buf)))
    print(name, round(total, 2), "s (voce", round(vlen, 2), "s)")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
