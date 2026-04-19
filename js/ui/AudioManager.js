export class AudioManager {
    constructor() {
        this.muted = localStorage.getItem('poker.muted') === '1';
        this.ctx = null;
        this.masterGain = null;
    }

    _ensureContext() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.35;
        this.masterGain.connect(this.ctx.destination);
    }

    async resumeIfSuspended() {
        this._ensureContext();
        if (this.ctx && this.ctx.state === 'suspended') {
            try { await this.ctx.resume(); } catch {}
        }
    }

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('poker.muted', this.muted ? '1' : '0');
        return this.muted;
    }

    play(name) {
        if (this.muted || !this.ctx) return;
        const fn = this._sounds[name];
        if (fn) fn.call(this, this.ctx, this.masterGain);
    }

    _envelope(gainNode, now, { a = 0.005, d = 0.05, s = 0, r = 0.05, peak = 1 }) {
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(peak, now + a);
        gainNode.gain.linearRampToValueAtTime(peak * s, now + a + d);
        gainNode.gain.linearRampToValueAtTime(0, now + a + d + r);
    }

    _tone(freq, { type = 'sine', duration = 0.15, peak = 0.4, a = 0.003, d = 0.02, s = 0.5, r = 0.1, detune = 0 }) {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (detune) osc.detune.setValueAtTime(detune, now);
        this._envelope(g, now, { a, d, s, r, peak });
        osc.connect(g).connect(this.masterGain);
        osc.start(now);
        osc.stop(now + duration + 0.05);
    }

    _noiseBurst({ duration = 0.08, peak = 0.3, filterFreq = 2000, filterType = 'lowpass' } = {}) {
        const ctx = this.ctx;
        const now = ctx.currentTime;
        const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) {
            data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
        }
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        filter.frequency.value = filterFreq;
        const g = ctx.createGain();
        this._envelope(g, now, { a: 0.001, d: duration * 0.5, s: 0.2, r: duration * 0.5, peak });
        src.connect(filter).connect(g).connect(this.masterGain);
        src.start(now);
        src.stop(now + duration + 0.05);
    }

    get _sounds() {
        return {
            deal: () => {
                // Short paper/card flip: filtered noise burst
                this._noiseBurst({ duration: 0.06, peak: 0.25, filterFreq: 3500, filterType: 'highpass' });
            },
            'chip-light': () => {
                // Single chip clack: short pitched noise + short ping
                this._noiseBurst({ duration: 0.04, peak: 0.18, filterFreq: 4500, filterType: 'bandpass' });
                this._tone(620, { type: 'square', duration: 0.06, peak: 0.08, a: 0.001, d: 0.01, s: 0.2, r: 0.04 });
            },
            'chip-heavy': () => {
                // Several chip clacks in quick succession
                const ctx = this.ctx;
                const now = ctx.currentTime;
                [0, 0.035, 0.07, 0.105].forEach(t => {
                    setTimeout(() => {
                        this._noiseBurst({ duration: 0.05, peak: 0.22, filterFreq: 4200, filterType: 'bandpass' });
                        this._tone(580 + Math.random() * 80, { type: 'square', duration: 0.06, peak: 0.09, a: 0.001, d: 0.01, s: 0.15, r: 0.04 });
                    }, t * 1000);
                });
            },
            fold: () => {
                // Whoosh: noise with downsweep LP filter
                const ctx = this.ctx;
                const now = ctx.currentTime;
                const dur = 0.22;
                const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
                const data = buffer.getChannelData(0);
                for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
                const src = ctx.createBufferSource();
                src.buffer = buffer;
                const filter = ctx.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.setValueAtTime(3200, now);
                filter.frequency.exponentialRampToValueAtTime(400, now + dur);
                const g = ctx.createGain();
                this._envelope(g, now, { a: 0.005, d: 0.08, s: 0.3, r: 0.12, peak: 0.22 });
                src.connect(filter).connect(g).connect(this.masterGain);
                src.start(now);
                src.stop(now + dur + 0.05);
            },
            check: () => {
                // Wood knock: low-freq click
                this._tone(180, { type: 'sine', duration: 0.1, peak: 0.3, a: 0.001, d: 0.015, s: 0, r: 0.05 });
                this._noiseBurst({ duration: 0.04, peak: 0.12, filterFreq: 800, filterType: 'lowpass' });
            },
            'all-in': () => {
                // Dramatic: two rising tones plus sweep
                this._tone(440, { type: 'triangle', duration: 0.18, peak: 0.35, a: 0.005, d: 0.03, s: 0.5, r: 0.1 });
                setTimeout(() => {
                    this._tone(660, { type: 'triangle', duration: 0.25, peak: 0.4, a: 0.005, d: 0.03, s: 0.6, r: 0.15 });
                }, 140);
                setTimeout(() => {
                    this._tone(880, { type: 'triangle', duration: 0.3, peak: 0.4, a: 0.005, d: 0.03, s: 0.6, r: 0.2 });
                }, 280);
            },
            win: () => {
                // Victory: major chord arpeggio C-E-G-C
                const notes = [523.25, 659.25, 783.99, 1046.50];
                notes.forEach((freq, i) => {
                    setTimeout(() => {
                        this._tone(freq, { type: 'triangle', duration: 0.3, peak: 0.3, a: 0.005, d: 0.04, s: 0.7, r: 0.2 });
                    }, i * 90);
                });
                // Bass thump
                this._tone(130.81, { type: 'sine', duration: 0.4, peak: 0.3, a: 0.01, d: 0.08, s: 0.4, r: 0.2 });
            },
            'blinds-up': () => {
                // Alert: two ascending beeps
                this._tone(740, { type: 'square', duration: 0.12, peak: 0.22, a: 0.005, d: 0.02, s: 0.6, r: 0.06 });
                setTimeout(() => {
                    this._tone(988, { type: 'square', duration: 0.15, peak: 0.22, a: 0.005, d: 0.02, s: 0.6, r: 0.08 });
                }, 130);
            }
        };
    }
}
