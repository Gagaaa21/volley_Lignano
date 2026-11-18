"""Pezzi della musica aggressiva del Monster block (usati da monster-block-aggressivo.py): power chord accordati bassi e molto
distorti, «BRAAAM» di ottoni distorti, bassi che crollano, piatto al contrario. build() fa un mix completo con una voce nuova
(165 bpm, chitarre a ottavi e doppia cassa sotto la voce, con la fascia della voce tolta alla musica mentre parla).
Uso: python3 musica-aggressiva.py <voce.wav> <nome uscita> [intensità]   (accanto: mix.py, mix3.py, mix4.py, mix5.py)
"""
import sys
import numpy as np
from mix import SR, RNG, crash, env_exp, hp, onepole_lp, place, save, t
from mix3 import hz, roar
from mix4 import arena, take
from mix5 import rock_kick, rock_snare, tom

BPM = 165
BEAT = 60 / BPM
S16 = BEAT / 4


def heavy(root, dur, amp=0.4, mute=False, drive=16.0):
    """Power chord molto distorto (due chitarre un filo stonate tra loro), cassa dell'ampli e un po' di «morso» sui medi."""
    n = int(SR * dur); tt = t(n); x = np.zeros(n)
    for ratio in (1.0, 1.5, 2.0):
        for d in (-0.006, -0.002, 0.003, 0.007):
            f = root * ratio * (1 + d)
            x += 2 * ((tt * f + RNG.uniform(0, 1)) % 1.0) - 1
    x /= 12
    y = np.tanh(drive * x)
    y = hp(y, 70)
    cut = 1500 if mute else 5200
    y = onepole_lp(onepole_lp(y, cut), cut)
    y = y + (y - onepole_lp(y, 900)) * 0.55
    att = np.minimum(1, tt / 0.003)
    env = att * (env_exp(n, 0.05) if mute else (0.75 + 0.25 * env_exp(n, 0.25))) * np.clip((dur - tt) / 0.03, 0, 1)
    return y * env * amp


def sub_drop(dur=1.2, amp=0.85):
    """I bassi che crollano sotto la botta: un tono profondo che scende da 90 a 32 Hz."""
    n = int(SR * dur); tt = t(n)
    f = 32 + 58 * np.exp(-tt / 0.18)
    return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR)) * env_exp(n, dur / 2.5) * amp


def braam(root, dur=1.2, amp=0.42):
    """Il «BRAAAM»: ottoni bassi distorti (seghe stonate), che si aprono di colpo e restano."""
    n = int(SR * dur); tt = t(n); x = np.zeros(n)
    for ratio in (1.0, 1.5, 2.0, 3.0):
        for d in (-0.012, -0.004, 0.004, 0.011):
            x += 2 * ((tt * root * ratio * (1 + d) + RNG.uniform(0, 1)) % 1.0) - 1
    x /= 16
    cut = 300 + 3200 * np.minimum(1, tt / 0.12) * (0.6 + 0.4 * env_exp(n, 0.6))
    y = onepole_lp(onepole_lp(x, cut), cut)
    y = np.tanh(5.0 * y)
    env = np.minimum(1, tt / 0.02) * np.clip((dur - tt) / 0.35, 0, 1)
    return y * env * amp


def reverse_cymbal(dur=0.9, amp=0.3):
    """Un piatto al contrario: sale fino alla botta."""
    return crash(dur, amp)[::-1].copy()


def build(path, name, power=1.0):
    v = take(path)
    vlen = len(v) / SR
    D2, F2, G2, A2, C3 = hz(38), hz(41), hz(43), hz(45), hz(48)
    vs = 0.3
    hit = vs + vlen + 0.08 + BEAT
    total = hit + 1.2
    music = np.zeros(int(SR * (total + 0.8))); vox = np.zeros_like(music)

    # Entrata: due colpi secchi d'accordo e cassa, il piatto.
    place(music, heavy(D2, 0.12, 0.5), 0.0); place(music, heavy(D2, 0.16, 0.5), 0.12)
    place(music, rock_kick(1.0), 0.0); place(music, rock_kick(0.9), 0.12)
    place(music, crash(1.4, 0.3), 0.0)
    place(vox, arena(v, wet=0.18), vs)
    # Sotto la voce: chitarre stoppate a sedicesimi in Re, doppia cassa a sedicesimi, rullante sul 2 e sul 4.
    groove_end = hit - BEAT - 0.02
    at, k = 0.3, 0
    while at < groove_end:
        accent = k % 4 == 0
        if k % 2 == 0: place(music, heavy(D2, S16 * 1.6, (0.24 if accent else 0.18) * power, mute=True), at)
        place(music, rock_kick((0.5 if k % 2 == 0 else 0.32) * power), at)
        if k % 8 == 4: place(music, rock_snare(0.45 * power), at)
        at += S16; k += 1
    # Prima della botta: il piatto al contrario e due colpi di tom.
    place(music, reverse_cymbal(0.9, 0.3 * power), hit - 0.9)
    place(music, tom(110, 0.4), hit - BEAT / 2); place(music, tom(150, 0.45), hit - BEAT / 4)
    # Due accordi d'attacco dopo la parola, poi la botta.
    place(music, heavy(F2, BEAT * 0.4, 0.45), hit - BEAT); place(music, rock_kick(0.9), hit - BEAT)
    place(music, heavy(G2, BEAT * 0.4, 0.45), hit - BEAT / 2); place(music, rock_kick(0.9), hit - BEAT / 2)
    place(music, heavy(D2, 1.15, 0.55), hit); place(music, heavy(D2 * 2, 1.15, 0.25), hit)
    place(music, braam(D2, 1.2, 0.42 * power), hit)
    place(music, sub_drop(1.2, 0.8 * power), hit)
    place(music, rock_kick(1.0), hit); place(music, rock_snare(0.6), hit)
    place(music, crash(1.8, 0.4), hit); place(music, crash(1.2, 0.25), hit + 0.02)
    # Un ultimo colpo di accordo sul tempo dopo, e la folla.
    place(music, heavy(C3, 0.18, 0.35), hit + 2 * BEAT); place(music, heavy(D2, 0.4, 0.4), hit + 2.5 * BEAT)
    place(music, rock_kick(0.8), hit + 2 * BEAT); place(music, rock_kick(0.8), hit + 2.5 * BEAT)
    place(music, roar(total - 0.3, 0.24, at=hit - 0.3), 0.3)

    n = int(SR * total)
    venv = np.sqrt(onepole_lp(vox[:n] ** 2, 10) + 1e-12); venv /= np.max(venv)
    duck = np.clip(venv * 2.5, 0, 1)
    # Mentre parla lo speaker, alla musica si toglie la fascia della voce (250-3500 Hz) e si abbassa il resto: chitarre e cassa
    # restano grosse, ma le parole passano.
    m = music[:n]
    mid = hp(onepole_lp(m, 3500), 250)
    m = m - mid * duck * 0.92
    buf = m * (1 - 0.55 * duck) + vox[:n] * 1.35
    buf = hp(buf, 30)
    # Più compressa e saturata della versione rock: più «in faccia».
    buf = np.tanh(1.8 * buf / np.max(np.abs(buf))) / np.tanh(1.8)
    fade = int(SR * 0.35); buf[-fade:] *= np.linspace(1, 0, fade) ** 2
    save(f"out/{name}.wav", buf * 0.85 / np.max(np.abs(buf)))
    print(name, round(total, 2), "s (voce", round(vlen, 2), "s)")


if __name__ == "__main__":
    build(sys.argv[1], sys.argv[2], float(sys.argv[3]) if len(sys.argv) > 3 else 1.0)
