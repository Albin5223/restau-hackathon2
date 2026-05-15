const SOUNDS = {
  releaseTable: "/sounds/liberer-table.mp3",
  releaseAll: "/sounds/dehors.mp3",
  placeOrder: "/sounds/fahh.mp3",
} as const;

export type SoundName = keyof typeof SOUNDS;

export function playSound(name: SoundName, volume = 0.8) {
  if (typeof window === "undefined") return;
  try {
    const audio = new Audio(SOUNDS[name]);
    audio.volume = Math.max(0, Math.min(1, volume));
    void audio.play().catch(() => {});
  } catch {
    // ignore — sound is non-critical
  }
}
