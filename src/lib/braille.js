// Shared Grade-1 Braille utilities: Unicode rendering + 6-dot cell bitmasks
// for driving refreshable hardware displays.
//
// Dot numbering (6-dot cell):   1 4
//                               2 5
//                               3 6
// Bit values: d1=0x01 d2=0x02 d3=0x04 d4=0x08 d5=0x10 d6=0x20

export const brailleMap = {
    'a': '⠁', 'b': '⠃', 'c': '⠉', 'd': '⠙', 'e': '⠑', 'f': '⠋', 'g': '⠛', 'h': '⠓', 'i': '⠊', 'j': '⠚',
    'k': '⠅', 'l': '⠇', 'm': '⠍', 'n': '⠝', 'o': '⠕', 'p': '⠏', 'q': '⠟', 'r': '⠗', 's': '⠎', 't': '⠞',
    'u': '⠥', 'v': '⠧', 'w': '⠺', 'x': '⠭', 'y': '⠽', 'z': '⠵',
    'A': '⠠⠁', 'B': '⠠⠃', 'C': '⠠⠉', 'D': '⠠⠙', 'E': '⠠⠑', 'F': '⠠⠋', 'G': '⠠⠛', 'H': '⠠⠓', 'I': '⠠⠊', 'J': '⠠⠚',
    'K': '⠠⠅', 'L': '⠠⠇', 'M': '⠠⠍', 'N': '⠠⠝', 'O': '⠠⠕', 'P': '⠠⠏', 'Q': '⠠⠟', 'R': '⠠⠗', 'S': '⠠⠎', 'T': '⠠⠞',
    'U': '⠠⠥', 'V': '⠠⠧', 'W': '⠠⠺', 'X': '⠠⠭', 'Y': '⠠⠽', 'Z': '⠠⠵',
    '1': '⠼⠁', '2': '⠼⠃', '3': '⠼⠉', '4': '⠼⠙', '5': '⠼⠑', '6': '⠼⠋', '7': '⠼⠛', '8': '⠼⠓', '9': '⠼⠊', '0': '⠼⠚',
    ' ': ' ', ',': '⠂', ';': '⠆', ':': '⠒', '.': '⠲', '?': '⠦', '!': '⠖', '"': '⠶', '(': '⠦', ')': '⠴',
    '-': '⠤', '\'': '⠄',
};

// 6-dot bitmasks for letters/digits (lowercase base forms).
const DOT = {
    a: 0x01, b: 0x03, c: 0x09, d: 0x19, e: 0x11, f: 0x0b, g: 0x1b, h: 0x13, i: 0x0a, j: 0x1a,
    k: 0x05, l: 0x07, m: 0x0d, n: 0x1d, o: 0x15, p: 0x0f, q: 0x1f, r: 0x17, s: 0x0e, t: 0x1e,
    u: 0x25, v: 0x27, w: 0x3a, x: 0x2d, y: 0x3d, z: 0x35,
};
const NUMBER_PREFIX = 0x3c; // dots 3-4-5-6
const CAPITAL_PREFIX = 0x28; // dot 4-6
const DIGIT_TO_LETTER = { '1': 'a', '2': 'b', '3': 'c', '4': 'd', '5': 'e', '6': 'f', '7': 'g', '8': 'h', '9': 'i', '0': 'j' };
const PUNCT_DOT = { '.': 0x1c, ',': 0x08, '?': 0x18, '!': 0x16, ':': 0x12, ';': 0x0c, '-': 0x24, '\'': 0x04, '"': 0x2c, '(': 0x36, ')': 0x36 };

export function toBraille(text) {
    return text.split('').map((ch) => brailleMap[ch] || ch).join('');
}

// Convert text into an array of cell bitmasks suitable for a refreshable
// display (one byte per braille cell). Capital letters and numbers emit a
// leading prefix cell, matching standard Grade-1 conventions.
export function toCells(text) {
    const cells = [];
    let inNumber = false;
    for (const ch of text) {
        if (/[0-9]/.test(ch)) {
            if (!inNumber) { cells.push(NUMBER_PREFIX); inNumber = true; }
            cells.push(DOT[DIGIT_TO_LETTER[ch]]);
            continue;
        }
        inNumber = false;
        if (/[A-Z]/.test(ch)) {
            cells.push(CAPITAL_PREFIX);
            cells.push(DOT[ch.toLowerCase()]);
        } else if (/[a-z]/.test(ch)) {
            cells.push(DOT[ch]);
        } else if (ch === ' ') {
            cells.push(0x00);
        } else if (PUNCT_DOT[ch] !== undefined) {
            cells.push(PUNCT_DOT[ch]);
        } else {
            cells.push(0x00);
        }
    }
    return cells;
}

// Dots active in a single character (for the visual tutor), 1-indexed.
export function charDots(ch) {
    const lower = String(ch).toLowerCase();
    if (!DOT[lower]) return [];
    const mask = DOT[lower];
    const out = [];
    for (let d = 1; d <= 6; d++) if (mask & (1 << (d - 1))) out.push(d);
    return out;
}
