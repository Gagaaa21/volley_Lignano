"""Rifà i suoni di partenza della pulsantiera della diretta (public/diretta/suoni/*.mp3, vedi src/lib/diretta/cues.ts).

Oggi sul sito c'è solo monsterBlock.mp3 (scelta del proprietario: gli altri tasti sono solo animazione, DEFAULT_SOUND_KINDS);
lo script sa fare anche gli altri, se un giorno tornassero a servire.

Tutto originale e libero, quindi sicuro su YouTube:
- le voci sono sintetiche, fatte con piper (pip install piper-tts) e voci libere prese da huggingface.co/rhasspy/piper-voices:
  en_US-bryce-medium (pubblico dominio), en_US-joe-medium (CC0), it_IT-paola-medium (CC0);
- la musica (tamburi, ottoni, piatti, folla) è sintetizzata qui con numpy.

Come si rifanno (in una cartella di lavoro con dentro models/<voce>.onnx e .onnx.json):

    gen(){ echo "$3" | python3 -m piper -m models/$1.onnx -f raw/$2.wav --length-scale $4 --noise-scale 0.8 --noise-w-scale 0.9; }
    gen en_US-joe-medium monster_joe "Monster block!" 1.05
    gen en_US-bryce-medium monster_bryce "Monster block!" 1.05
    gen en_US-bryce-medium ace4_bryce "Ace! Ace!" 1.05            # (noise 0.667 / 0.8)
    gen it_IT-paola-medium attack2_it "Super attacco!" 0.95
    gen it_IT-paola-medium dig2_it "Che difesa!" 0.95
    gen it_IT-paola-medium rally2_it "Che scambio!" 0.95
    gen it_IT-paola-medium cheer3_it "Forza, Lignano!" 1.05       # (noise 0.667 / 0.8)
    python3 suoni-pulsantiera.py                                   # -> out/<tasto>.wav
    # poi per ogni tasto: volume a -14 LUFS, limitatore a -2.4 dB, mp3 mono 44.1 kHz 96 kbit/s senza metadati:
    ffmpeg -i out/ace.wav -af "volume=<guadagno>dB,alimiter=limit=0.76:level=false" -ac 1 -c:a libmp3lame -b:a 96k \
      -map_metadata -1 -id3v2_version 0 -write_xing 0 ace.mp3

Servono numpy e ffmpeg (con rubberband). Le parole si controllano a orecchio (o con un riconoscitore vocale): con troppa
saturazione o eco «BLOCK» diventa «BLOOD». Rifatti i file, alzare DEFAULT_SOUNDS_VERSION in src/lib/diretta/cues.ts.
"""
import os, subprocess, wave
import numpy as np

SR = 44100
RNG = np.random.default_rng(7)
os.makedirs("out", exist_ok=True)
os.makedirs("tmp", exist_ok=True)


def load(path):
    w = wave.open(path)
    assert w.getframerate() == SR and w.getnchannels() == 1
    return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768


def save(path, x):
    x = np.clip(x, -1, 1)
    w = wave.open(path, "wb")
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((x * 32767).astype(np.int16).tobytes())
    w.close()


def voice(name, start, end, pitch=1.0, tempo=1.0, formant="shifted"):
    """Ritaglia la voce, la porta a 44.1 kHz e la abbassa (rubberband): più grossa, da speaker."""
    out = f"tmp/{name}_{pitch}_{tempo}.wav"
    af = f"atrim={start}:{end},asetpts=N/SR/TB,aresample={SR},rubberband=pitch={pitch}:tempo={tempo}:formant={formant}:transients=crisp"
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", f"raw/{name}.wav", "-af", af, "-ac", "1", "-ar", str(SR), out], check=True)
    x = load(out)
    fade = int(SR * 0.012)
    x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    return x / (np.max(np.abs(x)) + 1e-9)


def onepole_lp(x, cutoff):
    """Passa basso a un polo; cutoff può variare nel tempo (array)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=np.float64), x.shape)
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


def hp(x, cutoff):
    return x - onepole_lp(x, cutoff)


def t(n):
    return np.arange(n) / SR


def env_exp(n, decay):
    return np.exp(-t(n) / decay)


def boom(dur=0.55, f0=150, f1=42, amp=1.0):
    n = int(SR * dur); tt = t(n)
    f = f1 + (f0 - f1) * np.exp(-tt / 0.045)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * env_exp(n, dur / 3.2)
    click = RNG.standard_normal(n) * env_exp(n, 0.004) * 0.5
    return np.tanh(1.6 * (body + click)) * amp


def snare(dur=0.28, amp=0.6):
    n = int(SR * dur)
    noise = hp(RNG.standard_normal(n), 1200) * env_exp(n, 0.07)
    tone = np.sin(2 * np.pi * 190 * t(n)) * env_exp(n, 0.05)
    return (noise * 0.8 + tone * 0.5) * amp


def clap(amp=0.5):
    n = int(SR * 0.22); x = np.zeros(n)
    for k, off in enumerate([0, 0.011, 0.022, 0.034]):
        i = int(off * SR); m = n - i
        x[i:] += RNG.standard_normal(m) * env_exp(m, 0.012 if k < 3 else 0.06)
    x = hp(onepole_lp(x, 3500), 700)
    return x / np.max(np.abs(x)) * amp


def crash(dur=2.2, amp=0.35):
    n = int(SR * dur)
    x = hp(hp(RNG.standard_normal(n), 4000), 4000) * env_exp(n, dur / 4)
    shimmer = sum(np.sin(2 * np.pi * f * t(n) + RNG.uniform(0, 6)) for f in (3120, 4470, 5930, 7210)) * 0.05 * env_exp(n, dur / 5)
    return (x + shimmer) / 1.2 * amp


def brass(freqs, dur, amp=0.5, attack=0.025, bright=1.0):
    """Stab di ottoni: seghe un po' stonate + filtro che si apre e si chiude (il «blap»)."""
    n = int(SR * dur); tt = t(n); x = np.zeros(n)
    for f in freqs:
        for det in (-0.006, 0.0, 0.007):
            ph = (tt * f * (1 + det) + RNG.uniform(0, 1)) % 1.0
            x += 2 * ph - 1
    x /= len(freqs) * 3
    a = np.minimum(1, tt / attack)
    rel = np.clip((dur - tt) / 0.09, 0, 1)
    env = a * (0.75 + 0.25 * np.exp(-tt / 0.12)) * rel
    cutoff = (700 + 4200 * bright * np.exp(-tt / 0.18)) * (0.4 + 0.6 * a)
    y = onepole_lp(onepole_lp(x, cutoff), cutoff)
    return np.tanh(2.2 * y) * env * amp


def riser(dur=0.6, amp=0.25):
    n = int(SR * dur); tt = t(n)
    cutoff = 300 + 6000 * (tt / dur) ** 2
    x = onepole_lp(RNG.standard_normal(n), cutoff)
    x = hp(x, 250)
    return x * (tt / dur) ** 1.5 * amp


def crowd(dur, amp=0.12, swell=0.5):
    """Folla: rumore filtrato con tante «voci» che salgono e scendono."""
    n = int(SR * dur); tt = t(n)
    x = hp(onepole_lp(RNG.standard_normal(n), 2400), 380)
    wob = 1 + 0.25 * np.sin(2 * np.pi * 3.1 * tt) * np.sin(2 * np.pi * 0.7 * tt + 1)
    env = np.minimum(1, tt / swell) * np.clip((dur - tt) / 0.6, 0, 1)
    return x / np.max(np.abs(x)) * wob * env * amp


def blip(f0, f1, dur=0.12, amp=0.3):
    n = int(SR * dur); tt = t(n)
    f = f0 * (f1 / f0) ** (tt / dur)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, dur / 3) * amp


def whoosh(dur=0.5, amp=0.3, up=True):
    n = int(SR * dur); tt = t(n)
    c = 400 + 5000 * ((tt / dur) if up else (1 - tt / dur)) ** 2
    x = hp(onepole_lp(RNG.standard_normal(n), c), 300)
    env = np.sin(np.pi * tt / dur) ** 2
    return x * env * amp


def stadium(x, wet=0.45, taps=((0.115, 0.55), (0.23, 0.38), (0.36, 0.26), (0.52, 0.16), (0.71, 0.09))):
    """Eco da palazzetto: qualche ritorno sempre più cupo e un po' di coda densa."""
    out = np.concatenate([x, np.zeros(int(SR * 1.0))])
    for d, g in taps:
        i = int(d * SR)
        e = onepole_lp(np.concatenate([np.zeros(i), x, np.zeros(len(out) - len(x) - i)]), 2600)
        out += e * g * wet
    tail_n = int(SR * 0.9)
    ir = RNG.standard_normal(tail_n) * env_exp(tail_n, 0.22)
    ir = onepole_lp(ir, 3000); ir /= np.sqrt(np.sum(ir ** 2))
    rev = np.convolve(x, ir)[: len(out)] * 0.35 * wet
    out[: len(rev)] += rev
    return out


def shout(v, gain=1.0, drive=1.6, double=False):
    """Voce da stadio: raddoppiata (due «speaker»), saturata, compressa, con eco."""
    layers = v.copy()
    if double:
        d = int(SR * 0.018)
        layers = layers + np.concatenate([np.zeros(d), v[:-d]]) * 0.6
    layers = hp(layers, 110)
    bright = layers + hp(layers, 2500) * 0.6  # presenza
    y = np.tanh(drive * bright) / np.tanh(drive)
    return stadium(y * gain, wet=0.32)


def place(buf, x, at):
    i = int(at * SR)
    end = min(len(buf), i + len(x))
    buf[i:end] += x[: end - i]


def master(music, name, vox, target_peak=0.8):
    venv = np.sqrt(onepole_lp(vox ** 2, 8) + 1e-12)
    venv /= np.max(venv)
    duck = 1 - 0.55 * np.clip(venv * 2.5, 0, 1)
    buf = music * duck + vox * 1.15
    buf = hp(buf, 30)
    # Compressore semplice (RMS, lento) e limitatore morbido.
    rms = np.sqrt(onepole_lp(buf ** 2, 12) + 1e-9)
    gain = np.minimum(1, (0.32 / rms) ** 0.45)
    buf = buf * gain
    buf = np.tanh(1.3 * buf / np.max(np.abs(buf))) / np.tanh(1.3)
    fade = int(SR * 0.25)
    buf[-fade:] *= np.linspace(1, 0, fade) ** 2
    buf *= target_peak / np.max(np.abs(buf))
    save(f"out/{name}.wav", buf)
    print(name, round(len(buf) / SR, 2), "s")


# Note (Hz)
def hz(semi):  # semi da A4
    return 440 * 2 ** (semi / 12)

C4, D4, E4, F4, G4, A4, Bb4 = hz(-9), hz(-7), hz(-5), hz(-4), hz(-2), 440.0, hz(1)
C3, D3, F3, G3, Bb3 = hz(-21), hz(-19), hz(-16), hz(-14), hz(-11)
C5, D5, E5, F5, G5 = hz(3), hz(5), hz(7), hz(8), hz(10)

BEAT = 60 / 150  # 150 bpm


# ---------------------------------------------------------------- MONSTER BLOCK
def monster_block():
    dur = 3.6
    buf = np.zeros(int(SR * dur))
    vox = np.zeros_like(buf)
    # Prima grida una voce, poi l'altra (più alta e più forte): due «speaker» diversi, come allo stadio.
    v1 = voice("monster_bryce", 0.03, 0.84, pitch=0.90, tempo=0.95)
    v2 = voice("monster_joe", 0.24, 1.08, pitch=0.88, tempo=0.95, formant="preserved")
    # Botta d'entrata
    place(buf, boom(0.7, 170, 38, 1.0), 0.0)
    place(buf, crash(2.0, 0.32), 0.0)
    place(buf, brass([C3, G3, C4, E4, G4], 0.22, 0.42, bright=1.2), 0.0)
    # Il groove sotto la voce: boom boom CLAP, boom boom CLAP
    for k in range(6):
        at = 0.18 + k * BEAT / 2
        if k % 3 == 2:
            place(buf, clap(0.5), at); place(buf, snare(0.25, 0.35), at)
        else:
            place(buf, boom(0.32, 130, 45, 0.6), at)
    # Due grida, la seconda più forte e più alta
    place(vox, shout(v1, 0.85), 0.16)
    place(buf, riser(0.35, 0.18), 0.85)
    place(buf, boom(0.5, 160, 40, 0.9), 1.2)
    place(buf, crash(1.5, 0.22), 1.2)
    place(vox, shout(v2, 1.0, drive=1.9), 1.18)
    # Fanfara finale: ta-ta-TAAA
    fan = 2.22
    place(buf, brass([F3, C4, F4, A4], 0.16, 0.38), fan)
    place(buf, brass([G3, D4, G4, Bb4], 0.16, 0.40), fan + 0.19)
    place(buf, brass([C3, C4, E4, G4, C5], 1.05, 0.55, attack=0.03, bright=1.3), fan + 0.40)
    place(buf, boom(0.8, 180, 36, 1.0), fan + 0.40)
    place(buf, crash(1.6, 0.36), fan + 0.40)
    place(buf, snare(0.3, 0.4), fan); place(buf, snare(0.3, 0.45), fan + 0.19)
    place(buf, crowd(dur, 0.10, 0.8), 0.0)
    master(buf, "monsterBlock", vox)


# ---------------------------------------------------------------- ACE
def ace():
    dur = 2.9
    buf = np.zeros(int(SR * dur))
    vox = np.zeros_like(buf)
    place(buf, whoosh(0.45, 0.35, up=True), 0.0)
    place(buf, boom(0.7, 200, 40, 1.0), 0.42)
    place(buf, crash(2.0, 0.34), 0.42)
    place(buf, brass([D3, A4 / 2, D4, F4 * 2 ** (1 / 12), A4], 0.25, 0.45, bright=1.3), 0.42)
    v = voice("ace4_bryce", 0.03, 1.16, pitch=0.92, tempo=0.95)
    place(vox, shout(v, 0.95, drive=1.8), 0.48)
    # Fanfara: tu-ru-TU
    for k, chord in enumerate([[D4, F4 * 2 ** (1 / 12), A4], [E4, G4, hz(2)], [D4, F4 * 2 ** (1 / 12), A4, D5]]):
        place(buf, brass(chord, 0.14 if k < 2 else 0.8, 0.4 + 0.08 * k), 1.75 + k * 0.15)
    place(buf, boom(0.6, 170, 38, 0.8), 2.05)
    place(buf, crash(1.0, 0.25), 2.05)
    place(buf, crowd(dur, 0.10, 0.4), 0.0)
    master(buf, "ace", vox)


# ---------------------------------------------------------------- SUPER ATTACCO
def attack():
    dur = 2.7
    buf = np.zeros(int(SR * dur))
    vox = np.zeros_like(buf)
    # Botta forte con «tuono» (rumore basso che rimbomba)
    place(buf, boom(0.9, 220, 32, 1.0), 0.0)
    thunder = onepole_lp(RNG.standard_normal(int(SR * 1.2)), 300) * env_exp(int(SR * 1.2), 0.35)
    place(buf, thunder / np.max(np.abs(thunder)) * 0.45, 0.0)
    place(buf, crash(1.8, 0.34), 0.0)
    place(buf, brass([E4 / 2, B := hz(-10), E4, G4 * 2 ** (1 / 12), B * 2], 0.3, 0.45, bright=1.4), 0.0)
    v = voice("attack2_it", 0.12, 0.96, pitch=0.9, tempo=0.96)
    place(vox, shout(v, 0.95, drive=1.8), 0.1)
    for k in range(4):
        place(buf, boom(0.25, 140, 50, 0.55), 0.12 + k * BEAT / 2)
    place(buf, brass([E4, G4 * 2 ** (1 / 12), B * 2], 0.13, 0.38), 1.45)
    place(buf, brass([E4 * 1.0, A4, hz(4)], 0.13, 0.4), 1.6)
    place(buf, brass([E4 / 2, E4, G4 * 2 ** (1 / 12), B * 2, E5], 0.85, 0.52, bright=1.3), 1.76)
    place(buf, boom(0.7, 180, 36, 0.9), 1.76)
    place(buf, crash(0.9, 0.3), 1.76)
    place(buf, crowd(dur, 0.10, 0.3), 0.0)
    master(buf, "attack", vox)


# ---------------------------------------------------------------- CHE DIFESA (palla che rimbalza)
def dig():
    dur = 2.6
    buf = np.zeros(int(SR * dur))
    vox = np.zeros_like(buf)
    # Rimbalzi: boing sempre più vicini
    at = 0.0
    for k, gap in enumerate([0.24, 0.17, 0.12, 0.09]):
        place(buf, blip(900 - k * 60, 260, 0.16, 0.32), at)
        place(buf, boom(0.18, 160, 80, 0.35), at)
        at += gap
    place(buf, boom(0.6, 170, 40, 0.9), 0.62)
    place(buf, crash(1.5, 0.28), 0.62)
    place(buf, brass([F3, C4, F4, A4], 0.22, 0.42), 0.62)
    v = voice("dig2_it", 0.1, 0.68, pitch=0.92, tempo=0.95)
    place(vox, shout(v, 0.95, drive=1.8), 0.66)
    place(buf, brass([G3, D4, G4, Bb4], 0.13, 0.38), 1.5)
    place(buf, brass([F3, C4, F4, A4, C5], 0.75, 0.48), 1.66)
    place(buf, boom(0.6, 160, 40, 0.8), 1.66)
    place(buf, crash(0.9, 0.25), 1.66)
    place(buf, crowd(dur, 0.10, 0.4), 0.0)
    master(buf, "dig", vox)


# ---------------------------------------------------------------- CHE SCAMBIO (ping-pong)
def rally():
    dur = 2.7
    buf = np.zeros(int(SR * dur))
    vox = np.zeros_like(buf)
    for k in range(6):
        place(buf, blip(1300 if k % 2 else 950, 1100 if k % 2 else 800, 0.07, 0.28), k * 0.11)
    place(buf, boom(0.6, 170, 40, 0.95), 0.68)
    place(buf, crash(1.5, 0.3), 0.68)
    place(buf, brass([C3, G3, C4, E4, G4], 0.22, 0.42), 0.68)
    v = voice("rally2_it", 0.1, 0.7, pitch=0.95, tempo=0.95)
    place(vox, shout(v, 0.95, drive=1.8), 0.72)
    for k in range(3):
        place(buf, clap(0.38), 1.45 + k * 0.17)
    place(buf, brass([C4, E4, G4, C5], 0.8, 0.48), 1.95)
    place(buf, boom(0.6, 160, 40, 0.8), 1.95)
    place(buf, crash(0.8, 0.25), 1.95)
    place(buf, crowd(dur, 0.12, 0.3), 0.0)
    master(buf, "rally", vox)


# ---------------------------------------------------------------- FORZA LIGNANO (coro col battimani)
def cheer():
    dur = 3.4
    buf = np.zeros(int(SR * dur))
    vox = np.zeros_like(buf)
    # boom-boom-CLAP x2, poi il grido, poi clap-clap-clapclapclap
    for k in range(6):
        at = k * BEAT / 2
        if k % 3 == 2:
            place(buf, clap(0.55), at)
        else:
            place(buf, boom(0.3, 130, 45, 0.7), at)
    v = voice("cheer3_it", 0.12, 0.95, pitch=0.95, tempo=0.95)
    place(buf, boom(0.6, 170, 40, 0.95), 1.15)
    place(buf, crash(1.5, 0.3), 1.15)
    place(buf, brass([Bb3, F4, Bb4, D5], 0.24, 0.42), 1.15)
    place(vox, shout(v, 0.95, drive=1.8), 1.18)
    base = 2.2
    for k, off in enumerate([0, 0.2, 0.4, 0.5, 0.6]):
        place(buf, clap(0.55), base + off)
        place(buf, boom(0.25, 130, 50, 0.45), base + off)
    place(buf, crowd(dur, 0.16, 0.6), 0.0)
    master(buf, "cheer", vox)


if __name__ == "__main__":
    import sys
    which = sys.argv[1:] or ["monster_block", "ace", "attack", "dig", "rally", "cheer"]
    for w in which:
        globals()[w]()
