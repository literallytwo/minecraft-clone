// hash string seed to number (java hashCode algorithm, like Minecraft)
// if already a valid integer, use directly
export function hashSeed(seed: string): number {
  const parsed = parseInt(seed, 10);
  if (!isNaN(parsed) && parsed.toString() === seed.trim()) {
    return parsed;
  }

  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash | 0;
  }
  return hash;
}
