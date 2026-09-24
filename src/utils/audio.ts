// Web Audio API synthesizer for tactile mechanical calculator sound feedback
// and Web Vibration Haptic API for physical tactile feedback

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Triggers hardware vibration haptic feedback on devices that support navigator.vibrate
 */
export function triggerHapticFeedback(pattern: number | number[] = 25) {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Gracefully ignore if not supported or disabled by user/browser
  }
}

// Global button press vibration listener for touch / pointer interactions
if (typeof window !== 'undefined') {
  window.addEventListener(
    'pointerdown',
    (e) => {
      try {
        const target = (e.target as HTMLElement | null)?.closest?.(
          'button, [role="button"], input[type="button"], input[type="submit"], input[type="reset"]'
        );
        if (target) {
          triggerHapticFeedback(18);
        }
      } catch {}
    },
    { passive: true }
  );
}

export function playKeySound(type: 'num' | 'op' | 'action' | 'clear' | 'bill') {
  // Trigger appropriate haptic feedback pattern per key type
  if (type === 'num') {
    triggerHapticFeedback(15);
  } else if (type === 'op') {
    triggerHapticFeedback(25);
  } else if (type === 'action') {
    triggerHapticFeedback(35);
  } else if (type === 'bill') {
    triggerHapticFeedback([40, 50, 70]);
  } else {
    triggerHapticFeedback(45);
  }

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'num') {
      // Soft tactile mechanical click
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(200, now + 0.04);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.start(now);
      osc.stop(now + 0.04);
    } else if (type === 'op') {
      // Crisp operator click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(850, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'action') {
      // High bright beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1100, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === 'bill') {
      // Pleasant double chime for successful sale
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.08); // A5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.start(now);
      osc.stop(now + 0.22);
    } else {
      // Clear key thud
      osc.type = 'square';
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  } catch {
    // Gracefully ignore audio failures if blocked
  }
}

/**
 * Synthesizes a realistic POS cash register mechanical bell & drawer solenoid kick sound
 */
export function playCashDrawerSound() {
  triggerHapticFeedback([50, 40, 90]);
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Mechanical solenoid spring kick (low punch)
    const kickOsc = ctx.createOscillator();
    const kickGain = ctx.createGain();
    kickOsc.type = 'triangle';
    kickOsc.frequency.setValueAtTime(160, now);
    kickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.08);
    kickGain.gain.setValueAtTime(0.2, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    kickOsc.connect(kickGain);
    kickGain.connect(ctx.destination);
    kickOsc.start(now);
    kickOsc.stop(now + 0.09);

    // 2. High metallic spring ring & register bell chime (Ka-ching!)
    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = 'sine';
    bellOsc.frequency.setValueAtTime(1480, now + 0.03); // F#6
    bellOsc.frequency.setValueAtTime(1975, now + 0.11); // B6
    bellGain.gain.setValueAtTime(0.001, now);
    bellGain.gain.setValueAtTime(0.18, now + 0.03);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    bellOsc.connect(bellGain);
    bellGain.connect(ctx.destination);
    bellOsc.start(now + 0.03);
    bellOsc.stop(now + 0.38);
  } catch {
    // Gracefully ignore audio failures if blocked
  }
}
