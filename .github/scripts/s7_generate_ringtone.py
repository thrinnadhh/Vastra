from pathlib import Path
import math
import struct
import wave

path = Path('apps/merchant-app/assets/sounds/vastra_new_order.wav')
path.parent.mkdir(parents=True, exist_ok=True)
sample_rate = 22050
duration = 1.2
frames: list[bytes] = []
for index in range(int(sample_rate * duration)):
    time = index / sample_rate
    envelope = min(1.0, time / 0.04) * min(1.0, (duration - time) / 0.15)
    pulse = 1.0 if (index // int(sample_rate * 0.18)) % 2 == 0 else 0.55
    value = 0.38 * envelope * pulse * (
        math.sin(2 * math.pi * 740 * time) + 0.55 * math.sin(2 * math.pi * 988 * time)
    )
    sample = max(-32767, min(32767, int(value * 32767)))
    frames.append(struct.pack('<h', sample))
with wave.open(str(path), 'wb') as output:
    output.setnchannels(1)
    output.setsampwidth(2)
    output.setframerate(sample_rate)
    output.writeframes(b''.join(frames))
