const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const html = fs.readFileSync("index.html", "utf8");

function setup() {
  const elements = new Map();
  function element(id) {
    if (!elements.has(id)) {
      elements.set(id, {
        value: "",
        handlers: {},
        addEventListener(event, handler) { this.handlers[event] = handler; },
      });
    }
    return elements.get(id);
  }
  const presets = [...html.matchAll(/class="winner-cutoff-preset [^"]*" data-days="(\d+)"/g)]
    .map((match) => ({
      dataset: { days: match[1] },
      addEventListener(event, handler) { this[event] = handler; },
    }));
  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [2026, 2, 10, 12]));
    }
  }
  let confirmed = true;
  let saves = 0;
  const messages = [];
  const context = vm.createContext({
    Date: FixedDate,
    document: {
      getElementById: element,
      querySelectorAll: () => presets,
    },
    appState: { winners: [] },
    saveState: () => { saves++; },
    updateWinnersUI() {},
    showToast: (message) => messages.push(message),
    confirm: () => confirmed,
  });
  const start = html.indexOf("      const parseWinnerDate =");
  const end = html.indexOf("      function sanitizeCsvField", start);
  assert.ok(start !== -1 && end !== -1);
  vm.runInContext(html.slice(start, end), context);
  return {
    context, presets, element, messages,
    setConfirmed(value) { confirmed = value; },
    get saves() { return saves; },
  };
}

test("quick cutoff dates use local calendar days across month and DST boundaries", () => {
  const { presets, element } = setup();
  assert.deepEqual(presets.map((preset) => preset.dataset.days), ["1", "7", "30"]);
  for (const [index, expected] of ["2026-03-09", "2026-03-03", "2026-02-08"].entries()) {
    presets[index].click();
    assert.equal(element("winner-cutoff-date").value, expected);
  }
});

test("preset removal keeps the cutoff date and requires confirmation", () => {
  const app = setup();
  app.context.appState.winners = [
    { winnerName: "old", timestamp: "02/03/26 12:00" },
    { winnerName: "cutoff", timestamp: "03/03/26 12:00" },
    { winnerName: "new", timestamp: "04/03/26 12:00" },
    { winnerName: "unknown", timestamp: "invalid" },
  ];
  app.presets[1].click();
  const remove = app.element("btn-remove-old-winners").handlers.click;
  app.setConfirmed(false);
  remove();
  assert.equal(app.context.appState.winners.length, 4);
  assert.equal(app.saves, 0);

  app.setConfirmed(true);
  remove();
  assert.deepEqual(Array.from(app.context.appState.winners, (w) => w.winnerName), [
    "cutoff", "new", "unknown",
  ]);
  assert.equal(app.saves, 1);
});
