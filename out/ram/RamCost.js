"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatRam = formatRam;
// Render a GB figure at the resolution the game uses (hundredth-of-a-GB).
// Trailing zeros are trimmed so `0` and `2` don't render as `0.00 GB` /
// `2.00 GB` — matches the compact style used inside Bitburner's own UI.
function formatRam(gb) {
    if (!Number.isFinite(gb)) {
        return '?? GB';
    }
    const rounded = Math.round(gb * 100) / 100;
    const s = rounded.toFixed(2).replace(/\.?0+$/, '');
    return `${s} GB`;
}
//# sourceMappingURL=RamCost.js.map