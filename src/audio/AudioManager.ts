// simple audio manager for background music

class AudioManager {
  private audio: HTMLAudioElement | null = null;
  private isPlaying = false;

  playLoop(src: string): void {
    if (this.isPlaying) return;

    this.audio = new Audio(src);
    this.audio.loop = true;
    this.audio.volume = 0.5;

    // handle autoplay restrictions - user must have interacted first
    this.audio.play().catch(() => {
      // autoplay blocked, will try again on next user interaction
      const playOnInteraction = () => {
        if (this.audio && !this.isPlaying) {
          this.audio.play().catch(() => {});
          this.isPlaying = true;
        }
        document.removeEventListener('click', playOnInteraction);
        document.removeEventListener('keydown', playOnInteraction);
      };
      document.addEventListener('click', playOnInteraction);
      document.addEventListener('keydown', playOnInteraction);
    });

    this.isPlaying = true;
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
      this.audio = null;
    }
    this.isPlaying = false;
  }
}

export const audioManager = new AudioManager();
