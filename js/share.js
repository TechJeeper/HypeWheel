/**
 * HypeWheel share-link encode/decode (LZ + base64url).
 * Exposed as window.HypeShare
 */
(function (global) {
  "use strict";

  const IMAGE_BUDGET = 18000; // max data-URL length after shrink

  // Minimal LZ-String compressToEncodedURIComponent / decompressFromEncodedURIComponent
  // Adapted from pieroxy/lz-string (MIT)
  const keyStrUriSafe =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const baseReverseDic = {};

  const getBaseValue = (alphabet, character) => {
    if (!baseReverseDic[alphabet]) {
      baseReverseDic[alphabet] = {};
      for (let i = 0; i < alphabet.length; i++) {
        baseReverseDic[alphabet][alphabet.charAt(i)] = i;
      }
    }
    return baseReverseDic[alphabet][character];
  };

  const compressToEncodedURIComponent = (input) => {
    if (input == null) return "";
    return _compress(input, 6, (a) => keyStrUriSafe.charAt(a));
  };

  const decompressFromEncodedURIComponent = (input) => {
    if (input == null) return "";
    if (input === "") return null;
    input = input.replace(/ /g, "+");
    return _decompress(input.length, 32, (index) =>
      getBaseValue(keyStrUriSafe, input.charAt(index)),
    );
  };

  const _compress = (uncompressed, bitsPerChar, getCharFromInt) => {
    if (uncompressed == null) return "";
    let i;
    let value;
    const context_dictionary = {};
    const context_dictionaryToCreate = {};
    let context_c = "";
    let context_wc = "";
    let context_w = "";
    let context_enlargeIn = 2;
    let context_dictSize = 3;
    let context_numBits = 2;
    const context_data = [];
    let context_data_val = 0;
    let context_data_position = 0;

    for (let ii = 0; ii < uncompressed.length; ii++) {
      context_c = uncompressed.charAt(ii);
      if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
        context_dictionary[context_c] = context_dictSize++;
        context_dictionaryToCreate[context_c] = true;
      }
      context_wc = context_w + context_c;
      if (
        Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)
      ) {
        context_w = context_wc;
      } else {
        if (
          Object.prototype.hasOwnProperty.call(
            context_dictionaryToCreate,
            context_w,
          )
        ) {
          if (context_w.charCodeAt(0) < 256) {
            for (i = 0; i < context_numBits; i++) {
              context_data_val = context_data_val << 1;
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 8; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          } else {
            value = 1;
            for (i = 0; i < context_numBits; i++) {
              context_data_val = (context_data_val << 1) | value;
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = 0;
            }
            value = context_w.charCodeAt(0);
            for (i = 0; i < 16; i++) {
              context_data_val = (context_data_val << 1) | (value & 1);
              if (context_data_position === bitsPerChar - 1) {
                context_data_position = 0;
                context_data.push(getCharFromInt(context_data_val));
                context_data_val = 0;
              } else {
                context_data_position++;
              }
              value = value >> 1;
            }
          }
          context_enlargeIn--;
          if (context_enlargeIn === 0) {
            context_enlargeIn = Math.pow(2, context_numBits);
            context_numBits++;
          }
          delete context_dictionaryToCreate[context_w];
        } else {
          value = context_dictionary[context_w];
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn === 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        context_dictionary[context_wc] = context_dictSize++;
        context_w = String(context_c);
      }
    }

    if (context_w !== "") {
      if (
        Object.prototype.hasOwnProperty.call(
          context_dictionaryToCreate,
          context_w,
        )
      ) {
        if (context_w.charCodeAt(0) < 256) {
          for (i = 0; i < context_numBits; i++) {
            context_data_val = context_data_val << 1;
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 8; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i = 0; i < context_numBits; i++) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 16; i++) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position++;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn--;
        if (context_enlargeIn === 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits++;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i = 0; i < context_numBits; i++) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position++;
          }
          value = value >> 1;
        }
      }
      context_enlargeIn--;
      if (context_enlargeIn === 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits++;
      }
    }

    value = 2;
    for (i = 0; i < context_numBits; i++) {
      context_data_val = (context_data_val << 1) | (value & 1);
      if (context_data_position === bitsPerChar - 1) {
        context_data_position = 0;
        context_data.push(getCharFromInt(context_data_val));
        context_data_val = 0;
      } else {
        context_data_position++;
      }
      value = value >> 1;
    }

    while (true) {
      context_data_val = context_data_val << 1;
      if (context_data_position === bitsPerChar - 1) {
        context_data.push(getCharFromInt(context_data_val));
        break;
      } else context_data_position++;
    }
    return context_data.join("");
  };

  const _decompress = (length, resetValue, getNextValue) => {
    const dictionary = [];
    let enlargeIn = 4;
    let dictSize = 4;
    let numBits = 3;
    let entry = "";
    const result = [];
    let w;
    let bits;
    let resb;
    let maxpower;
    let power;
    let c;
    const data = { val: getNextValue(0), position: resetValue, index: 1 };

    for (let i = 0; i < 3; i++) dictionary[i] = i;

    bits = 0;
    maxpower = Math.pow(2, 2);
    power = 1;
    while (power !== maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position === 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch (bits) {
      case 0:
        bits = 0;
        maxpower = Math.pow(2, 8);
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = String.fromCharCode(bits);
        break;
      case 1:
        bits = 0;
        maxpower = Math.pow(2, 16);
        power = 1;
        while (power !== maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position === 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        c = String.fromCharCode(bits);
        break;
      case 2:
        return "";
    }

    dictionary[3] = c;
    w = c;
    result.push(c);

    while (true) {
      if (data.index > length) return "";
      bits = 0;
      maxpower = Math.pow(2, numBits);
      power = 1;
      while (power !== maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }

      switch ((c = bits)) {
        case 0:
          bits = 0;
          maxpower = Math.pow(2, 8);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = String.fromCharCode(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 1:
          bits = 0;
          maxpower = Math.pow(2, 16);
          power = 1;
          while (power !== maxpower) {
            resb = data.val & data.position;
            data.position >>= 1;
            if (data.position === 0) {
              data.position = resetValue;
              data.val = getNextValue(data.index++);
            }
            bits |= (resb > 0 ? 1 : 0) * power;
            power <<= 1;
          }
          dictionary[dictSize++] = String.fromCharCode(bits);
          c = dictSize - 1;
          enlargeIn--;
          break;
        case 2:
          return result.join("");
      }

      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }

      if (dictionary[c]) {
        entry = dictionary[c];
      } else {
        if (c === dictSize) {
          entry = w + w.charAt(0);
        } else {
          return null;
        }
      }
      result.push(entry);
      dictionary[dictSize++] = w + entry.charAt(0);
      enlargeIn--;
      w = entry;
      if (enlargeIn === 0) {
        enlargeIn = Math.pow(2, numBits);
        numBits++;
      }
    }
  };

  const loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("image load failed"));
      img.src = src;
    });

  /**
   * Keep http(s) URLs as-is. Shrink large data: URLs to JPEG so they fit in share links.
   * Returns { value, shrunk, omitted }.
   */
  const prepareImageForShare = async (value, maxPx = 150) => {
    if (!value || typeof value !== "string") {
      return { value: "", shrunk: false, omitted: false };
    }
    if (!value.startsWith("data:")) {
      return { value, shrunk: false, omitted: false };
    }
    // Compress any non-trivial data URL so center/custom images survive share links
    if (value.length <= 4000) {
      return { value, shrunk: false, omitted: false };
    }

    try {
      const img = await loadImage(value);
      const sizes = [maxPx, Math.round(maxPx * 0.7), Math.round(maxPx * 0.5)];
      const qualities = [0.72, 0.6, 0.5];

      for (const size of sizes) {
        for (const quality of qualities) {
          const scale = Math.min(1, size / Math.max(img.width, img.height, 1));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          // White background so JPEG doesn't turn transparent areas black
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const out = canvas.toDataURL("image/jpeg", quality);
          if (out.length <= IMAGE_BUDGET) {
            return { value: out, shrunk: true, omitted: false };
          }
        }
      }
    } catch {
      /* fall through */
    }
    if (value.length <= IMAGE_BUDGET) {
      return { value, shrunk: false, omitted: false };
    }
    return { value: "", shrunk: false, omitted: true };
  };

  const trimImage = (value) => {
    if (!value || typeof value !== "string") return "";
    if (value.startsWith("data:") && value.length > IMAGE_BUDGET) return "";
    return value;
  };

  const wheelToShareable = (wheel) => ({
    title: wheel.title || "Shared Wheel",
    rawText: wheel.rawText || "",
    palette: wheel.palette || "rainbow",
    customTextColor: wheel.customTextColor || "#ffffff",
    spinSpeed: wheel.spinSpeed || "normal",
    spinDuration: wheel.spinDuration || "medium",
    spinSound: wheel.spinSound !== undefined ? wheel.spinSound : true,
    countdownEnabled: !!wheel.countdownEnabled,
    countdownSeconds: wheel.countdownSeconds || 60,
    confettiEnabled:
      wheel.confettiEnabled !== undefined ? wheel.confettiEnabled : true,
    fontFamily: wheel.fontFamily || "system-ui",
    pointerStyle: wheel.pointerStyle || "classic",
    layout: wheel.layout || "right",
    seed: wheel.seed || "",
    centerImage: trimImage(wheel.centerImage),
    customImage: trimImage(wheel.customImage),
  });

  const wheelToShareableAsync = async (wheel) => {
    const center = await prepareImageForShare(wheel.centerImage, 150);
    const custom = await prepareImageForShare(wheel.customImage, 360);
    return {
      shareable: {
        ...wheelToShareable({
          ...wheel,
          centerImage: "",
          customImage: "",
        }),
        centerImage: center.value,
        customImage: custom.value,
      },
      shrunkImages: center.shrunk || custom.shrunk,
      omittedImages: center.omitted || custom.omitted,
    };
  };

  const encodePayload = (payload) => {
    const json = JSON.stringify(payload);
    return compressToEncodedURIComponent(json);
  };

  const decodePayload = (encoded) => {
    try {
      const json = decompressFromEncodedURIComponent(encoded);
      if (!json) return null;
      const data = JSON.parse(json);
      if (!data || data.v !== 1 || !Array.isArray(data.wheels)) return null;
      return data;
    } catch {
      return null;
    }
  };

  // Put payload in the hash (#w=…) so GitHub Pages never sees it (avoids 414 URI Too Long).
  // Legacy ?w= links still decode via getUrlParam.
  const applyShareToUrl = (baseUrl, encoded, options = {}) => {
    const url = new URL(baseUrl);
    url.search = "";
    url.hash = "";
    if (options.overlay) url.searchParams.set("overlay", "1");
    url.hash = "w=" + encoded;
    return url.toString();
  };

  const buildShareUrl = (baseUrl, wheels, options = {}) => {
    const payload = {
      v: 1,
      wheels: (wheels || []).map(wheelToShareable),
    };
    const encoded = encodePayload(payload);
    return {
      url: applyShareToUrl(baseUrl, encoded, options),
      omittedImages: payload.wheels.some(
        (w, i) =>
          (wheels[i].centerImage && !w.centerImage) ||
          (wheels[i].customImage && !w.customImage),
      ),
      shrunkImages: false,
    };
  };

  const buildShareUrlAsync = async (baseUrl, wheels, options = {}) => {
    const prepared = await Promise.all(
      (wheels || []).map((w) => wheelToShareableAsync(w)),
    );
    const payload = {
      v: 1,
      wheels: prepared.map((p) => p.shareable),
    };
    const encoded = encodePayload(payload);
    return {
      url: applyShareToUrl(baseUrl, encoded, options),
      omittedImages: prepared.some((p) => p.omittedImages),
      shrunkImages: prepared.some((p) => p.shrunkImages),
    };
  };

  global.HypeShare = {
    encodePayload,
    decodePayload,
    buildShareUrl,
    buildShareUrlAsync,
    wheelToShareable,
    compressToEncodedURIComponent,
    decompressFromEncodedURIComponent,
  };
})(typeof window !== "undefined" ? window : globalThis);
