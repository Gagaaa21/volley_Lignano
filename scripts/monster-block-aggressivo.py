"""Rifà il Monster block attuale (versione 7): dal file della versione 6 si tiene il tratto con la voce dello speaker
(0,33-3,05 s, lì la musica rock di prima era quasi muta) e intorno si costruisce la parte aggressiva, in Mi: entrata con due
colpi d'accordo distorto, rombo basso (sotto i 220 Hz, non copre le parole) e piatto al contrario sotto la voce, rullata di tom,
due accordi d'attacco, botta con «BRAAAM», bassi che crollano, doppia cassa, piatti, folla. Poi compressione
(acompressor -20 dB, 3:1), -14 LUFS circa, limitatore e mp3 mono 96 kbit/s. Intensità usata: 1.4.
Uso: python3 monster-block-aggressivo.py <versione6.wav> monsterBlock 1.4   (accanto: mix.py, mix3.py, mix4.py, mix5.py,
mix6.py = musica-aggressiva.py)
"""
import sys
import numpy as np
from mix import SR, crash, hp, load, onepole_lp, place, save
from mix3 import hz, roar
from mix5 import rock_kick, rock_snare, tom
from mix6 import braam, heavy, reverse_cymbal, sub_drop

src, name = sys.argv[1], sys.argv[2]
power = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
x = load(src)
A, B = 0.33, 3.05  # il tratto con la voce (misurato sul file pubblicato)
voice = x[int(A * SR) : int(B * SR)].copy()
f = int(0.012 * SR); voice[:f] *= np.linspace(0, 1, f)
f = int(0.03 * SR); voice[-f:] *= np.linspace(1, 0, f)

E2, G2, A2, B2, D3 = hz(40), hz(43), hz(45), hz(47), hz(50)
BEAT = 60 / 165
hit = B + 0.42
total = hit + 1.25
music = np.zeros(int(SR * (total + 1.0)))
vox = np.zeros_like(music)
place(vox, voice, A)

# Entrata: due colpi secchi d'accordo distorto, cassa, piatto.
place(music, heavy(E2, 0.12, 0.55), 0.0); place(music, heavy(E2, 0.17, 0.55), 0.13)
place(music, heavy(E2 * 2, 0.3, 0.2), 0.0)
place(music, rock_kick(1.0), 0.0); place(music, rock_kick(0.95), 0.13); place(music, rock_snare(0.45), 0.13)
place(music, crash(1.5, 0.3), 0.0)
# Sotto la voce: solo un rombo basso distorto (sotto i 220 Hz: non copre le parole) che cresce, e il piatto al contrario.
n = int((B - A) * SR)
drone = onepole_lp(onepole_lp(heavy(E2 / 2 * 2, B - A, 0.5, drive=10.0), 220), 220)
drone *= np.linspace(0.3, 1.0, len(drone)) ** 1.5
place(music, drone * power, A)
place(music, hp(reverse_cymbal(1.0, 0.28 * power), 2500), hit - 1.0)
# Appena finita la parola: rullata secca di tom e due accordi d'attacco, poi la botta.
for j, fq in enumerate((100, 130, 170)):
    place(music, tom(fq, 0.45), B + j * BEAT / 4)
place(music, heavy(G2, BEAT * 0.3, 0.5), hit - BEAT * 0.75); place(music, rock_kick(0.95), hit - BEAT * 0.75)
place(music, heavy(A2, BEAT * 0.3, 0.5), hit - BEAT * 0.37); place(music, rock_kick(0.95), hit - BEAT * 0.37)
place(music, heavy(E2, 1.2, 0.6), hit); place(music, heavy(E2 * 2, 1.2, 0.28), hit)
place(music, braam(E2, 1.25, 0.45 * power), hit)
place(music, sub_drop(1.25, 0.85 * power), hit)
place(music, rock_kick(1.0), hit); place(music, rock_snare(0.65), hit)
place(music, crash(1.8, 0.42), hit); place(music, crash(1.3, 0.26), hit + 0.015)
# Doppia cassa sotto la botta e due colpi finali sul tempo.
k = 1
while k * BEAT / 4 < 0.75:
    place(music, rock_kick(0.45 * power), hit + k * BEAT / 4); k += 1
place(music, heavy(D3 / 2, 0.16, 0.42), hit + 2 * BEAT); place(music, rock_kick(0.9), hit + 2 * BEAT)
place(music, heavy(E2, 0.45, 0.48), hit + 2.5 * BEAT); place(music, rock_kick(0.9), hit + 2.5 * BEAT); place(music, crash(0.9, 0.25), hit + 2.5 * BEAT)
place(music, roar(total - B + 0.3, 0.26, at=0.25), B - 0.3)

n = int(SR * total)
buf = music[:n] + vox[:n] * 1.0
buf = hp(buf, 30)
buf = np.tanh(1.6 * buf / np.max(np.abs(buf))) / np.tanh(1.6)
fade = int(SR * 0.35); buf[-fade:] *= np.linspace(1, 0, fade) ** 2
save(f"out/{name}.wav", buf * 0.85 / np.max(np.abs(buf)))
print(name, round(total, 2), "s")
