(function (global) {
  const presets = [
    { id: "classic", label: "Classic", type: "sine", from: 800, to: 400, duration: 0.05 },
    { id: "wood", label: "Wood", type: "triangle", from: 350, to: 110, duration: 0.04 },
    { id: "digital", label: "Digital", type: "square", from: 1100, to: 750, duration: 0.035 },
    { id: "bell", label: "Bell", type: "sine", from: 1600, to: 1400, duration: 0.12 },
    { id: "pop", label: "Pop", type: "sine", from: 600, to: 90, duration: 0.06 },
    { id: "laser", label: "Laser", type: "sawtooth", from: 1800, to: 250, duration: 0.09 },
    { id: "chime", label: "Chime", type: "triangle", from: 1200, to: 1500, duration: 0.16 },
    { id: "arcade", label: "Arcade", type: "square", from: 450, to: 900, duration: 0.07 },
  ];

  const normalize = (value) =>
    presets.some((preset) => preset.id === value) ? value : "classic";

  let audioCtx = null;
  const play = (sound, volume, peak = 0.3) => {
    if (volume <= 0) return;
    const preset = presets.find((item) => item.id === normalize(sound));
    if (!audioCtx)
      audioCtx = new (global.AudioContext || global.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;

    osc.type = preset.type;
    osc.frequency.setValueAtTime(preset.from, now);
    osc.frequency.exponentialRampToValueAtTime(preset.to, now + preset.duration);
    gain.gain.setValueAtTime(peak * volume, now);
    gain.gain.exponentialRampToValueAtTime(0.01 * volume, now + preset.duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(now + preset.duration);
  };

  global.HypeSpinSounds = { presets, normalize, play };
})(typeof window !== "undefined" ? window : globalThis);
