const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");
const soundSource = fs.readFileSync("js/spin-sounds.js", "utf8");
const shareSource = fs.readFileSync("js/share.js", "utf8");

function setup() {
  const notes = [];
  let contexts = 0;
  class AudioContext {
    constructor() {
      contexts++;
      this.currentTime = 0;
      this.state = "running";
      this.destination = {};
    }
    createOscillator() {
      const note = { frequencies: [] };
      notes.push(note);
      return {
        set type(value) { note.type = value; },
        frequency: {
          setValueAtTime(value) { note.frequencies.push(value); },
          exponentialRampToValueAtTime(value) { note.frequencies.push(value); },
        },
        connect() {},
        start() {},
        stop(time) { note.duration = time; },
      };
    }
    createGain() {
      const note = notes[notes.length - 1];
      note.gains = [];
      return {
        gain: {
          setValueAtTime(value) { note.gains.push(value); },
          exponentialRampToValueAtTime(value) { note.gains.push(value); },
        },
        connect() {},
      };
    }
  }
  const context = vm.createContext({ AudioContext, URL, console });
  vm.runInContext(soundSource, context);
  vm.runInContext(shareSource, context);
  return { context, sounds: context.HypeSpinSounds, notes, getContexts: () => contexts };
}

test("spin sounds have distinct playback, preserve classic, and respect volume", () => {
  const { sounds, notes, getContexts } = setup();
  assert.equal(sounds.normalize(undefined), "classic");
  assert.equal(sounds.normalize("invalid"), "classic");
  sounds.play("bell", 0);
  assert.equal(getContexts(), 0);
  for (const preset of sounds.presets) sounds.play(preset.id, 0.5);
  assert.equal(new Set(notes.map((note) => `${note.type}:${note.frequencies}`)).size, 4);
  assert.deepEqual(notes[0].frequencies, [800, 400]);
  assert.deepEqual(notes[0].gains, [0.15, 0.005]);
  sounds.play("invalid", 1, 0.1);
  assert.deepEqual(notes[4].frequencies, [800, 400]);
  assert.deepEqual(notes[4].gains, [0.1, 0.01]);
});

test("wheel sound survives save, import and share; old data remains compatible", async () => {
  const { context, sounds } = setup();
  const start = html.indexOf("      class WheelApp {");
  const end = html.indexOf("      class SlotMachineApp {", start);
  const saved = { id: "test" };
  Object.assign(context, {
    appState: { wheelsConfig: [saved] },
    scheduleWheelsSave() {},
    normalizeSoundVolume: (value) => typeof value === "number" ? value : 100,
    showToast() {},
  });
  const Wheel = vm.runInContext(`${html.slice(start, end)}; WheelApp`, context);
  const wheel = Object.create(Wheel.prototype);
  Object.assign(wheel, {
    id: "test",
    rawText: "A",
    spinSoundType: "wood",
    spinSoundVolume: 50,
    zoomLevel: 1,
  });
  wheel.saveConfig();
  assert.equal(saved.spinSoundType, "wood");
  assert.equal(wheel.getSerializableConfig().spinSoundType, "wood");

  const element = () => ({ classList: { add() {}, remove() {} } });
  wheel.dom = new Proxy({ wrapper: { querySelector: () => null } }, {
    get(target, key) { return target[key] || (target[key] = element()); },
  });
  for (const method of ["updateTwitchWatchUI", "applyLayout", "drawPointerPreview", "handleResize", "updateUIState"]) {
    wheel[method] = () => {};
  }
  wheel.applyImportedWheel({ wheel: { spinSoundType: "bell" } });
  assert.equal(wheel.spinSoundType, "bell");
  assert.equal(wheel.dom.soundTypeSelect.value, "bell");
  assert.equal(saved.spinSoundType, "bell");
  wheel.applyImportedWheel({ wheel: { title: "Old wheel" } });
  assert.equal(wheel.spinSoundType, "bell");
  wheel.applyImportedWheel({ wheel: { spinSoundType: "unsupported" } });
  assert.equal(wheel.spinSoundType, "classic");

  for (const preset of sounds.presets) {
    const shared = await context.HypeShare.buildShareUrlAsync("https://example.com/", [{ spinSoundType: preset.id }]);
    const payload = context.HypeShare.decodePayload(new URL(shared.url).hash.slice(3));
    assert.equal(payload.wheels[0].spinSoundType, preset.id);
  }
  assert.equal(context.HypeShare.wheelToShareable({}).spinSoundType, "classic");
});

test("slot sound follows loudest enabled wheel, breaking ties in wheel order", () => {
  const { context } = setup();
  context.normalizeSoundVolume = (value) => typeof value === "number" ? value : 100;
  const start = html.indexOf("      class SlotMachineApp {");
  const end = html.indexOf("      // --- APP MANAGER ---", start);
  const Slot = vm.runInContext(`${html.slice(start, end)}; SlotMachineApp`, context);
  const slot = Object.create(Slot.prototype);
  slot.columns = [
    { config: { spinSound: true, spinSoundVolume: 25, spinSoundType: "wood" } },
    { config: { spinSound: true, spinSoundVolume: 50, spinSoundType: "bell" } },
    { config: { spinSound: true, spinSoundVolume: 50, spinSoundType: "digital" } },
    { config: { spinSound: false, spinSoundVolume: 100, spinSoundType: "classic" } },
  ];
  assert.equal(slot.getSoundConfig().type, "bell");
  assert.equal(slot.getSoundConfig().volume, 50);
  slot.columns.forEach((column) => { column.config.spinSound = false; });
  assert.equal(slot.getSoundConfig().volume, 0);
});

test("settings selection saves and preview respects the sound toggle and volume", () => {
  const { context, notes } = setup();
  const saved = { id: "test" };
  let notice = "";
  Object.assign(context, {
    appState: { wheelsConfig: [saved] },
    scheduleWheelsSave() {},
    normalizeSoundVolume: (value) => value,
    showToast(message) { notice = message; },
  });
  const start = html.indexOf("      class WheelApp {");
  const end = html.indexOf("      class SlotMachineApp {", start);
  const Wheel = vm.runInContext(`${html.slice(start, end)}; WheelApp`, context);
  const wheel = Object.create(Wheel.prototype);
  const element = () => ({
    events: {},
    addEventListener(type, handler) { this.events[type] = handler; },
  });
  wheel.dom = new Proxy({}, {
    get(target, key) { return target[key] || (target[key] = element()); },
  });
  Object.assign(wheel, {
    id: "test",
    spinSound: true,
    spinSoundType: "classic",
    spinSoundVolume: 50,
    drawPointerPreview() {},
  });
  wheel.bindEvents();
  wheel.dom.soundTypeSelect.events.change({ target: { value: "digital" } });
  assert.equal(saved.spinSoundType, "digital");
  wheel.dom.btnPreviewSound.events.click();
  assert.equal(notes[0].type, "square");
  assert.equal(notes[0].gains[0], 0.15);
  wheel.dom.soundCheckbox.events.change({ target: { checked: false } });
  wheel.dom.btnPreviewSound.events.click();
  assert.equal(notes.length, 1);
  assert.match(notice, /Enable sound/);
  wheel.dom.soundCheckbox.events.change({ target: { checked: true } });
  wheel.dom.soundVolumeInput.events.input({ target: { value: "0" } });
  wheel.dom.btnPreviewSound.events.click();
  assert.equal(notes.length, 1);
});
