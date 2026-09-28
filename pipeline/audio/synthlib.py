"""
synthlib.py - tiny self-contained DSP/synthesis toolkit shared by make_music.py and make_sfx.py.

Everything here is pure numpy/scipy: oscillators (PolyBLEP band-limited saw/pulse, triangle, sine),
envelopes, RBJ biquads (static and time-varying), a synthesized-IR stereo reverb, a sidechain
pump envelope, a lookahead peak limiter, an ITU-R BS.1770-4 integrated loudness meter, and WAV I/O.

No samples are ever loaded - every sound in the pipeline is generated from these primitives,
which keeps the audio 100% original (no copyright claims).
"""
from __future__ import annotations

import numpy as np
import soundfile as sf
from scipy import signal

SR = 48000


# ----------------------------------------------------------------------------- helpers
def db2lin(db):
    return 10.0 ** (np.asarray(db, dtype=np.float64) / 20.0)


def lin2db(x, floor=-200.0):
    x = np.maximum(np.abs(np.asarray(x, dtype=np.float64)), 1e-12)
    return np.maximum(20.0 * np.log10(x), floor)


def midi2hz(m):
    return 440.0 * 2.0 ** ((np.asarray(m, dtype=np.float64) - 69.0) / 12.0)


def n_samples(sec, sr=SR):
    return max(1, int(round(sec * sr)))


def pan_stereo(x, pan):
    """Constant-power pan. pan in [-1 (L), +1 (R)]; pan may be a scalar or per-sample array."""
    pan = np.clip(pan, -1.0, 1.0)
    ang = (pan + 1.0) * np.pi / 4.0
    return np.stack([x * np.cos(ang), x * np.sin(ang)], axis=0)


def add_at(buf, x, start):
    """Mix x (mono 1D or (ch, n)) into buf (same ndim) at integer sample offset, clipping to bounds."""
    n = buf.shape[-1]
    if start >= n:
        return
    xs = x.shape[-1]
    s0 = max(0, start)
    off = s0 - start
    e = min(n, start + xs)
    if e <= s0:
        return
    buf[..., s0:e] += x[..., off:off + (e - s0)]


def fade(x, fade_in=0.003, fade_out=0.01, sr=SR):
    """Raised-cosine fades at both ends (works on mono or (ch, n))."""
    x = np.array(x, dtype=np.float64, copy=True)
    n = x.shape[-1]
    fi = min(n // 2, int(fade_in * sr))
    fo = min(n // 2, int(fade_out * sr))
    if fi > 0:
        x[..., :fi] *= 0.5 - 0.5 * np.cos(np.linspace(0, np.pi, fi))
    if fo > 0:
        x[..., n - fo:] *= 0.5 + 0.5 * np.cos(np.linspace(0, np.pi, fo))
    return x


# ----------------------------------------------------------------------------- oscillators
def phase_from_freq(freq, n, sr=SR, phase0=0.0):
    """freq: scalar or array (Hz). Returns fractional phase in [0,1) and per-sample increment dt."""
    if np.isscalar(freq):
        dt = np.full(n, float(freq) / sr)
    else:
        dt = np.asarray(freq, dtype=np.float64)[:n] / sr
    ph = (phase0 + np.cumsum(dt) - dt[0]) % 1.0
    return ph, np.abs(dt)


def _polyblep(t, dt):
    out = np.zeros_like(t)
    dt = np.maximum(dt, 1e-9)
    m = t < dt
    x = t[m] / dt[m]
    out[m] = x + x - x * x - 1.0
    m2 = t > 1.0 - dt
    x = (t[m2] - 1.0) / dt[m2]
    out[m2] = x * x + x + x + 1.0
    return out


def osc_saw(freq, n, sr=SR, phase0=0.0):
    t, dt = phase_from_freq(freq, n, sr, phase0)
    return 2.0 * t - 1.0 - _polyblep(t, dt)


def osc_pulse(freq, n, duty=0.5, sr=SR, phase0=0.0):
    t, dt = phase_from_freq(freq, n, sr, phase0)
    naive = np.where(t < duty, 1.0, -1.0)
    y = naive + _polyblep(t, dt) - _polyblep((t - duty) % 1.0, dt)
    return y - (2.0 * duty - 1.0)  # remove DC of asymmetric pulse


def osc_tri(freq, n, sr=SR, phase0=0.0, steps=None):
    """Triangle. steps=16/32 gives a stepped NES-flavoured triangle."""
    t, _ = phase_from_freq(freq, n, sr, phase0)
    y = 4.0 * np.abs(t - 0.5) - 1.0
    if steps:
        y = np.round((y + 1.0) * (steps - 1) / 2.0) / ((steps - 1) / 2.0) - 1.0
        y = lowpass(y, 9000.0, sr=sr)
    return y


def osc_sine(freq, n, sr=SR, phase0=0.0):
    t, _ = phase_from_freq(freq, n, sr, phase0)
    return np.sin(2.0 * np.pi * t)


def noise(n, rng, color="white"):
    w = rng.standard_normal(n)
    if color == "white":
        return w / 3.0
    if color == "pink":
        # Paul Kellet-ish pink via 1st-order filter bank approximation
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        y = signal.lfilter(b, a, w)
        return y / (np.std(y) * 3.0 + 1e-12)
    if color == "brown":
        y = signal.lfilter([1.0], [1.0, -0.995], w)
        y = highpass(y, 15.0)
        return y / (np.std(y) * 3.0 + 1e-12)
    raise ValueError(color)


# ----------------------------------------------------------------------------- envelopes
def env_adsr(n_on, a=0.005, d=0.1, s=0.7, r=0.05, sr=SR, curve=True):
    """Returns envelope of length n_on + release samples."""
    na, nd, nr = int(a * sr), int(d * sr), int(r * sr)
    env = np.full(n_on, s, dtype=np.float64)
    if na > 0:
        k = min(na, n_on)
        env[:k] = np.linspace(0, 1, na, endpoint=False)[:k]
    if nd > 0 and na < n_on:
        k = min(nd, n_on - na)
        dec = np.exp(-5.0 * np.arange(nd) / nd) if curve else np.linspace(1, 0, nd)
        dec = s + (1 - s) * dec
        env[na:na + k] = dec[:k]
    last = env[-1] if n_on > 0 else 0.0
    rel = last * (np.exp(-6.0 * np.arange(nr) / max(nr, 1)) if curve else np.linspace(1, 0, nr))
    if nr > 0:
        rel *= np.linspace(1, 0, nr) ** 0.5  # guarantee reaching zero
    return np.concatenate([env, rel])


def env_exp(n, tau, sr=SR):
    return np.exp(-np.arange(n) / (tau * sr))


# ----------------------------------------------------------------------------- filters
def _sos(kind, fc, sr, order=2, q=None):
    fc = float(np.clip(fc, 5.0, sr * 0.49))
    if kind in ("low", "high"):
        return signal.butter(order, fc, btype=kind + "pass", fs=sr, output="sos")
    raise ValueError(kind)


def lowpass(x, fc, order=2, sr=SR):
    return signal.sosfilt(_sos("low", fc, sr, order), x, axis=-1)


def highpass(x, fc, order=2, sr=SR):
    return signal.sosfilt(_sos("high", fc, sr, order), x, axis=-1)


def bandpass(x, lo, hi, order=2, sr=SR):
    sos = signal.butter(order, [max(lo, 5.0), min(hi, sr * 0.49)], btype="bandpass", fs=sr, output="sos")
    return signal.sosfilt(sos, x, axis=-1)


def rbj(kind, fc, q, sr=SR, gain_db=0.0):
    """RBJ cookbook biquad coefficients (b, a) normalized."""
    fc = min(max(fc, 5.0), sr * 0.47)
    w0 = 2 * np.pi * fc / sr
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bp":
        b = [alpha, 0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def tv_filter(x, fc, kind="lp", q=0.707, block=64, sr=SR):
    """Time-varying biquad: fc is a per-sample array (same length as x, mono 1D). Block-wise update."""
    x = np.asarray(x, dtype=np.float64)
    fc = np.broadcast_to(np.asarray(fc, dtype=np.float64), x.shape)
    y = np.empty_like(x)
    zi = np.zeros(2)
    for s in range(0, len(x), block):
        e = min(len(x), s + block)
        b, a = rbj(kind, float(fc[(s + e) // 2]), q, sr)
        y[s:e], zi = signal.lfilter(b, a, x[s:e], zi=zi)
    return y


def peq(x, fc, q, gain_db, sr=SR):
    b, a = rbj("peak", fc, q, sr, gain_db)
    return signal.lfilter(b, a, x, axis=-1)


# ----------------------------------------------------------------------------- effects
def saturate(x, drive=1.0):
    if drive <= 0:
        return x
    return np.tanh(x * drive) / np.tanh(drive)


def bitcrush(x, bits=6, hold=1):
    q = 2 ** (bits - 1)
    y = np.round(x * q) / q
    if hold > 1:
        idx = (np.arange(len(y)) // hold) * hold
        y = y[idx]
    return y


def make_reverb_ir(rng, seconds=1.6, rt60=1.2, predelay=0.012, damp_hz=6500.0, sr=SR, width=1.0):
    """Stereo IR: decorrelated noise with exponential decay, progressively darker tail."""
    n = n_samples(seconds, sr)
    t = np.arange(n) / sr
    decay = np.exp(-6.9078 * t / rt60)
    irs = []
    for ch in range(2):
        nz = rng.standard_normal(n)
        bright = nz * decay
        dark = lowpass(nz, damp_hz * 0.35, sr=sr) * decay
        mix = np.clip(t / seconds * 1.5, 0, 1)
        ir = lowpass((1 - mix) * bright + mix * dark * 2.0, damp_hz, sr=sr)
        ir[: int(predelay * sr)] = 0.0
        ir = fade(ir, 0.004, 0.05, sr)
        irs.append(ir)
    irs = np.array(irs)
    mid = irs.mean(0, keepdims=True)
    irs = mid + width * (irs - mid)
    irs /= np.sqrt(np.sum(irs ** 2, axis=1, keepdims=True)) + 1e-12
    return irs


def apply_reverb(x_st, ir):
    """x_st (2, n) -> wet (2, n + len(ir) - 1)."""
    return np.stack([signal.fftconvolve(x_st[c], ir[c]) for c in range(2)])


def pingpong_delay(x_mono, delay_s, feedback=0.35, repeats=6, sr=SR, lp_hz=5000.0):
    """Returns stereo (2, n) of only the wet echoes, bouncing L/R and getting darker."""
    d = int(delay_s * sr)
    n = len(x_mono) + d * repeats
    out = np.zeros((2, n))
    tap = lowpass(x_mono, lp_hz, sr=sr)
    g = 1.0
    for k in range(1, repeats + 1):
        g *= feedback
        ch = (k - 1) % 2
        add_at(out[ch], tap * g, d * k)
        tap = lowpass(tap, lp_hz, sr=sr)
    return out


def sidechain_env(n, kick_samples, depth=0.6, release_s=0.22, sr=SR, attack_s=0.004):
    """Gain envelope that dips at each kick and recovers (classic 'pumping')."""
    env = np.ones(n)
    L = int(release_s * sr)
    A = max(1, int(attack_s * sr))
    x = np.arange(L) / L
    shape = 1.0 - depth * (1.0 - x) ** 2.2
    att = np.linspace(1.0, 1.0 - depth, A)
    for k in kick_samples:
        s0 = k - A
        seg = np.concatenate([att, shape])
        s, e = max(0, s0), min(n, s0 + len(seg))
        if e > s:
            env[s:e] = np.minimum(env[s:e], seg[s - s0:e - s0])
    return env


def compressor(x, thresh_db=-12.0, ratio=2.0, attack=0.01, release=0.15, makeup_db=0.0, sr=SR):
    """Simple feed-forward RMS-ish compressor (stereo-linked). x: (ch, n)."""
    det = np.max(np.abs(x), axis=0) if x.ndim == 2 else np.abs(x)
    # smooth detector with attack/release using a two-stage one-pole (fast approx, vectorized)
    a_rel = np.exp(-1.0 / (release * sr))
    lvl = signal.lfilter([1 - a_rel], [1, -a_rel], det ** 2) ** 0.5
    a_att = np.exp(-1.0 / (attack * sr))
    lvl = np.maximum(lvl, signal.lfilter([1 - a_att], [1, -a_att], det))
    ldb = lin2db(lvl)
    over = np.maximum(ldb - thresh_db, 0.0)
    gr_db = -over * (1.0 - 1.0 / ratio)
    g = db2lin(gr_db + makeup_db)
    return x * g


def limiter(x, ceiling_db=-1.0, lookahead=0.005, release=0.08, sr=SR, oversample=4):
    """Lookahead brickwall limiter on true-peak estimate. x: (ch, n). Returns limited copy."""
    from scipy.ndimage import minimum_filter1d, uniform_filter1d

    ceil = db2lin(ceiling_db)
    # true-peak-ish detector (oversampled)
    if oversample > 1:
        up = signal.resample_poly(x, oversample, 1, axis=-1)
        pk = np.max(np.abs(up), axis=0).reshape(-1, oversample).max(axis=1)[: x.shape[-1]]
    else:
        pk = np.max(np.abs(x), axis=0)
    req = np.minimum(1.0, ceil / np.maximum(pk, 1e-12))
    W = max(3, int(lookahead * sr)) | 1
    g = minimum_filter1d(req, size=2 * W + 1, mode="nearest")
    # release smoothing: one-pole upward only (take min with the gate-safe curve afterwards)
    a = np.exp(-1.0 / (release * sr))
    g_rel = signal.lfilter([1 - a], [1, -a], g - 1.0) + 1.0
    g_rel[0] = g[0]
    g = np.minimum(g, g_rel)
    g = uniform_filter1d(g, size=W, mode="nearest")  # each output <= req (window-min then shorter average)
    g = np.minimum(g, req)  # hard guarantee
    return x * g


def dc_block(x, sr=SR, fc=18.0):
    return highpass(x, fc, order=2, sr=sr)


# ----------------------------------------------------------------------------- metering
def _k_weight(x, sr=SR):
    if sr != 48000:
        x = signal.resample_poly(x, 48000, sr, axis=-1)
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    return signal.lfilter(b2, a2, signal.lfilter(b1, a1, x, axis=-1), axis=-1)


def integrated_lufs(x, sr=SR):
    """ITU-R BS.1770-4 integrated loudness (gated). x mono (n,) or (ch, n) with L/R weights 1."""
    x = np.atleast_2d(np.asarray(x, dtype=np.float64))
    y = _k_weight(x, sr)
    fs = 48000
    blk, hop = int(0.4 * fs), int(0.1 * fs)
    n = y.shape[-1]
    if n < blk:  # very short: pad with silence so there is one block (reported value is then conservative)
        y = np.pad(y, ((0, 0), (0, blk - n)))
        n = blk
    starts = np.arange(0, n - blk + 1, hop)
    cs = np.cumsum(np.pad(y ** 2, ((0, 0), (1, 0))), axis=-1)
    ms = (cs[:, starts + blk] - cs[:, starts]) / blk
    z = ms.sum(axis=0)
    l = -0.691 + 10 * np.log10(np.maximum(z, 1e-20))
    g = l > -70.0
    if not np.any(g):
        return -np.inf
    rel = -0.691 + 10 * np.log10(np.mean(z[g])) - 10.0
    g2 = g & (l > rel)
    return float(-0.691 + 10 * np.log10(np.mean(z[g2])))


def true_peak_db(x, oversample=4):
    x = np.atleast_2d(x)
    up = signal.resample_poly(x, oversample, 1, axis=-1)
    return float(lin2db(np.max(np.abs(up))))


def sample_peak_db(x):
    return float(lin2db(np.max(np.abs(x))))


def normalize_peak(x, peak_db=-1.0):
    pk = np.max(np.abs(x))
    return x * (db2lin(peak_db) / pk) if pk > 0 else x


def write_wav(path, x, sr=SR):
    """x: mono (n,) or (ch, n). Writes 24-bit PCM WAV."""
    x = np.asarray(x, dtype=np.float64)
    data = x.T if x.ndim == 2 else x
    sf.write(str(path), data, sr, subtype="PCM_24")
