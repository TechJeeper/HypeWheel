/**
 * HypeWheel fairness helpers — seeded PRNG and spin proof strings.
 * Exposed as window.HypeFairness
 */
(function (global) {
  "use strict";

  const seedToUint32 = (seed) => {
    const hex = String(seed || "")
      .replace(/[^0-9a-f]/gi, "")
      .padEnd(8, "0")
      .slice(0, 8);
    const n = parseInt(hex, 16);
    return Number.isFinite(n) ? n >>> 0 : 1;
  };

  /** Mulberry32 PRNG — returns a function yielding [0, 1). */
  const createSeededRng = (seed) => {
    let state = seedToUint32(seed) || 1;
    return () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const seededRandomInt = (rng, maxExclusive) => {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError("maxExclusive must be a positive safe integer");
    }
    return Math.floor(rng() * maxExclusive);
  };

  /** FNV-1a 32-bit hash of normalized entries → 8-char hex. */
  const hashEntries = (entries) => {
    const normalized = (entries || [])
      .map((e) => String(e).trim())
      .filter((e) => e !== "")
      .join("\n");
    let hash = 0x811c9dc5;
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
  };

  const pickWinnerIndex = (seed, entryCount) => {
    const rng = createSeededRng(seed);
    return seededRandomInt(rng, entryCount);
  };

  /**
   * Derive spin animation params from the same PRNG stream used for the winner.
   * Consumes: 1 int (winner) already taken if you pass rng after pick —
   * or call getSpinParams(seed, entryCount, speedStr, durationStr) which
   * creates a fresh stream and advances past the winner pick.
   */
  const getSpinParams = (seed, entryCount, speedStr, durationStr) => {
    const rng = createSeededRng(seed);
    const winningIndex = seededRandomInt(rng, entryCount);

    let minSpins = 5;
    let maxSpinsRange = 5;
    if (speedStr === "slow") {
      minSpins = 3;
      maxSpinsRange = 3;
    } else if (speedStr === "fast") {
      minSpins = 8;
      maxSpinsRange = 4;
    }

    let minDuration = 10000;
    let maxDurationRange = 4000;
    if (durationStr === "short") {
      minDuration = 4000;
      maxDurationRange = 2000;
    } else if (durationStr === "long") {
      minDuration = 16000;
      maxDurationRange = 6000;
    }

    const duration = minDuration + rng() * maxDurationRange;
    const extraSpins = minSpins + seededRandomInt(rng, maxSpinsRange);

    return { winningIndex, duration, extraSpins };
  };

  const formatProofString = ({ seed, entriesHash, winner, entryCount }) =>
    [
      "HypeWheel-Proof-v1",
      `seed=${seed}`,
      `entries=${entriesHash}`,
      `count=${entryCount}`,
      `winner=${winner}`,
    ].join("|");

  const parseProofString = (text) => {
    const parts = String(text || "").trim().split("|");
    if (parts[0] !== "HypeWheel-Proof-v1") return null;
    const map = {};
    for (let i = 1; i < parts.length; i++) {
      const eq = parts[i].indexOf("=");
      if (eq === -1) continue;
      map[parts[i].slice(0, eq)] = parts[i].slice(eq + 1);
    }
    if (!map.seed || !map.entries || map.winner === undefined) return null;
    return {
      seed: map.seed,
      entriesHash: map.entries,
      entryCount: map.count ? parseInt(map.count, 10) : null,
      winner: map.winner,
    };
  };

  /**
   * Recompute expected winner from seed + entries list.
   * Returns { ok, expectedWinner, expectedIndex, entriesHash, message }.
   */
  const verifySpin = (seed, entries, claimedWinner) => {
    const list = (entries || [])
      .map((e) => String(e).trim())
      .filter((e) => e !== "");
    if (list.length === 0) {
      return { ok: false, message: "No entries to verify against." };
    }
    const entriesHash = hashEntries(list);
    const expectedIndex = pickWinnerIndex(seed, list.length);
    const expectedWinner = list[expectedIndex];
    const ok =
      claimedWinner === undefined ||
      claimedWinner === null ||
      claimedWinner === "" ||
      expectedWinner === claimedWinner;
    return {
      ok,
      expectedWinner,
      expectedIndex,
      entriesHash,
      message: ok
        ? `Verified: seed ${seed} → ${expectedWinner}`
        : `Mismatch: seed predicts "${expectedWinner}", proof claims "${claimedWinner}"`,
    };
  };

  global.HypeFairness = {
    createSeededRng,
    seededRandomInt,
    hashEntries,
    pickWinnerIndex,
    getSpinParams,
    formatProofString,
    parseProofString,
    verifySpin,
  };
})(typeof window !== "undefined" ? window : globalThis);
