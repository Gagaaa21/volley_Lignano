"""Rifà il suono del Monster block della pulsantiera (public/diretta/suoni/monsterBlock.mp3): lo speaker urla
«MOOONSTEEEER BLOOOOOCK!» (vocali allungate con allunga-vocali.py) con l'eco dell'arena, sopra una musica rock da stadio
originale: chitarre distorte sintetizzate (power chord), batteria rock con rullata di tom, piatti, folla.
Uso (cartella di lavoro con mix.py = suoni-pulsantiera.py, mix3.py = monster-block.py, mix4.py = monster-block-arena.py):
    python3 monster-block-rock.py <voce allungata.wav> monsterBlock   -> out/monsterBlock.wav, poi -14 LUFS e mp3 mono 96 kbit/s
Rifatto il file, alzare DEFAULT_SOUNDS_VERSION in src/lib/diretta/cues.ts.
"""
import sys
import numpy as np
from mix import SR, RNG, crash, env_exp, hp, onepole_lp, place, save, t
from mix3 import hz, roar
from mix4 import arena, take

BPM = 138
BEAT = 60 / BPM
E8 = BEAT / 2


def guitar(root, dur, amp=0.4, mute=False):
    """Power chord distorto: fondamentale, quinta e ottava, corde un filo stonate, saturazione forte e «cassa» dell'ampli."""
    n = int(SR * dur); tt = t(n); x = np.zeros(n)
    for ratio in (1.0, 1.5, 2.0):
        for d in (-0.004, 0.0, 0.005):
            f = root * ratio * (1 + d)
            x += 2 * ((tt * f + RNG.uniform(0, 1)) % 1.0) - 1
    x /= 9
    y = np.tanh(9.0 * x)
    y = hp(y, 90)
    y = onepole_lp(onepole_lp(y, 1800 if mute else 4200), 1800 if mute else 4200)
    y = y + (y - onepole_lp(y, 1200)) * 0.4  # un po' di «morso» sui medi
    att = np.minimum(1, tt / 0.004)
    env = att * (env_exp(n, 0.07) if mute else (0.7 + 0.3 * env_exp(n, 0.3))) * np.clip((dur - tt) / 0.04, 0, 1)
    return y * env * amp


def rock_kick(amp=0.9):
    n = int(SR * 0.4); tt = t(n)
    f = 52 + 90 * np.exp(-tt / 0.025)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.14)
    beater = hp(RNG.standard_normal(n), 2500) * env_exp(n, 0.004) * 0.5
    return np.tanh(1.8 * (body + beater)) * amp


def rock_snare(amp=0.55):
    n = int(SR * 0.45); tt = t(n)
    tone = np.sin(2 * np.pi * 185 * tt) * env_exp(n, 0.06) + np.sin(2 * np.pi * 330 * tt) * env_exp(n, 0.04) * 0.5
    wires = hp(RNG.standard_normal(n), 1500) * env_exp(n, 0.11)
    room = onepole_lp(RNG.standard_normal(n), 3000) * env_exp(n, 0.25) * 0.25
    return np.tanh(1.5 * (tone * 0.7 + wires * 0.8 + room)) * amp


def tom(f0, amp=0.6):
    n = int(SR * 0.5); tt = t(n)
    f = f0 * (1 + 0.5 * np.exp(-tt / 0.03))
    return np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.16)) * amp


def build(path, name):
    v = take(path)
    vlen = len(v) / SR
    E2, D2, G2, A2 = hz(40), hz(38), hz(43), hz(45)
    vs = 0.32
    # La botta finale cade appena finisce il grido, sul tempo.
    # Prima finisce il grido, poi i due accordi d'attacco («ta-ta») e la botta («TAAAN»): niente chitarre sopra la parola.
    hit = vs + vlen + 0.1 + BEAT
    total = hit + 1.1
    music = np.zeros(int(SR * (total + 0.6))); vox = np.zeros_like(music)

    # Entrata: accordo pieno, piatto, cassa.
    place(music, guitar(E2, 0.32, 0.42), 0.0); place(music, rock_kick(1.0), 0.0); place(music, crash(1.8, 0.32), 0.0)
    place(vox, arena(v, wet=0.18), vs)
    # Sotto il grido: chitarre stoppate in ottavi e batteria rock (cassa sull'1 e sul 3, rullante sul 2 e sul 4).
    fill = hit - 2 * BEAT
    at, k = 0.55, 0
    while at < fill - 0.01:
        place(music, guitar(E2, E8 * 0.9, 0.22, mute=True), at)
        at += E8
    k = 1
    while k * BEAT < fill - 0.01:
        b = k * BEAT
        place(music, rock_kick(0.75) if k % 2 == 0 else rock_snare(0.42), b)
        if k % 2 == 0: place(music, rock_kick(0.5), b + E8)
        k += 1
    # Rullata di tom prima della botta: dal basso verso l'alto (sale, non cade), e un «whoosh» che sale sotto l'ultima vocale.
    from mix3 import riser
    place(music, hp(riser(1.0, 0.09), 2500), hit - 1.0)
    for j, f in enumerate((90, 90, 120, 120, 165, 165, 220, 220)):
        place(music, tom(f, 0.26), fill + j * BEAT / 4)
    # Il riff finale: G5 - A5 corti, poi E5 lungo, e il pubblico che esplode.
    place(music, guitar(G2, BEAT * 0.45, 0.4), hit - BEAT)
    place(music, guitar(A2, BEAT * 0.45, 0.4), hit - BEAT / 2)
    place(music, guitar(E2, 1.35, 0.46), hit)
    place(music, guitar(E2 * 2, 1.35, 0.22), hit)
    place(music, rock_kick(1.0), hit); place(music, rock_snare(0.5), hit); place(music, crash(1.9, 0.38), hit)
    place(music, crash(1.2, 0.2), hit + BEAT * 2)
    place(music, roar(total - 0.3, 0.24, at=hit - 0.3), 0.3)

    n = int(SR * total)
    venv = np.sqrt(onepole_lp(vox[:n] ** 2, 10) + 1e-12); venv /= np.max(venv)
    buf = music[:n] * (1 - 0.8 * np.clip(venv * 2.5, 0, 1)) + vox[:n] * 1.3
    buf = hp(buf, 30)
    buf = np.tanh(1.3 * buf / np.max(np.abs(buf))) / np.tanh(1.3)
    fade = int(SR * 0.4); buf[-fade:] *= np.linspace(1, 0, fade) ** 2
    save(f"out/{name}.wav", buf * 0.85 / np.max(np.abs(buf)))
    print(name, round(total, 2), "s (voce", round(vlen, 2), "s)")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2])
