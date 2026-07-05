// Render a GB figure at the resolution the game uses (hundredth-of-a-GB).
// Trailing zeros are trimmed so `0` and `2` don't render as `0.00 GB` /
// `2.00 GB` — matches the compact style used inside Bitburner's own UI.
export function formatRam(gb: number): string {
    if (!Number.isFinite(gb)) {
        return '?? GB';
    }
    const rounded = Math.round(gb * 100) / 100;
    const s = rounded.toFixed(2).replace(/\.?0+$/, '');
    return `${s} GB`;
}
