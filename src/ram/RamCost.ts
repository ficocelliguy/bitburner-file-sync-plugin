// Static RAM cost estimation for Netscript scripts.
//
// This is a deliberately lightweight approximation of what Bitburner does
// internally (see bitburner-src/src/Script/RamCalculations.ts, which walks a
// full AST). The extension only needs a rough, fast number for the status
// bar — the user has already accepted that false positives are OK, so we
// scan text tokens instead of parsing.
//
// The cost table is derived from JSDoc `@remarks RAM cost: X GB` markers in
// NetscriptDefinitions.d.ts, which the extension already downloads. This
// keeps the table honest as the game evolves without shipping a bundled
// copy that would go stale.

export interface RamCostEntry {
    name: string;
    cost: number;
}

export interface ScriptRamCost {
    total: number;
    entries: RamCostEntry[];
}

// TypeScript-declaration keywords that can appear immediately after a JSDoc
// block. If the token following a comment matches one of these, we know we
// hit an interface/class/type header rather than a method declaration and
// skip it — otherwise a JSDoc that happens to mention "RAM cost" in prose
// on a namespace interface would attach that cost to the word `export`.
const DECLARATION_KEYWORDS = new Set([
    'export', 'interface', 'class', 'type', 'enum', 'namespace',
    'declare', 'function', 'const', 'let', 'var', 'abstract',
    'readonly', 'public', 'private', 'protected', 'static',
    'async',
]);

// Extract method-name → RAM-cost pairs from NetscriptDefinitions.d.ts.
//
// Anchors on JSDoc blocks so the "RAM cost: X GB" marker inside the comment
// is unambiguously paired with the declaration that follows. Duplicate names
// (e.g. `getServer` on both NS and Darknet) resolve to the higher cost —
// the calculator uses a flat identifier set, and overestimating is safer
// than underestimating for a user-facing budget number.
export function parseRamCosts(source: string): Map<string, number> {
    const result = new Map<string, number>();
    // /**  ...  */  name  ( | ? | <
    // The `?|<|\(` character class filters property declarations (`x: T;`)
    // out — only optional-methods, generic-methods, and plain methods pass.
    // Content uses `[^*]|\*(?!\/)` rather than a lazy `[\s\S]*?` so the regex
    // engine cannot expand a failing match across intervening `*/` closers:
    // otherwise a prose "RAM cost: X GB" in an interface-level JSDoc would
    // paper over the enclosed methods' individual JSDoc and attribute the
    // wrong cost.
    const re = /\/\*\*((?:[^*]|\*(?!\/))*)\*\/\s*(\w+)\s*(?:\?|<|\()/g;
    const costRe = /RAM cost:\s*([\d.]+)\s*GB/i;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
        const jsdoc = m[1];
        const name = m[2];
        if (DECLARATION_KEYWORDS.has(name)) {
            continue;
        }
        const cm = costRe.exec(jsdoc);
        if (!cm) {
            continue;
        }
        const cost = parseFloat(cm[1]);
        if (!Number.isFinite(cost) || cost < 0) {
            continue;
        }
        const existing = result.get(name);
        if (existing === undefined || cost > existing) {
            result.set(name, cost);
        }
    }
    result.set("document", 25);
    result.set("window", 25);
    return result;
}

// Sum unique ns method identifiers appearing in `source`.
//
// Deliberately simple: any word token matching a known ns method name counts
// once, with its highest known RAM cost. This overcounts (a local `write`
// variable, a `hack` in a string comment) — the game's own AST-based
// calculator has similar coarse behavior when identifiers alias ns names,
// and the user has flagged false positives as acceptable in exchange for
// keeping this cheap.
export function computeScriptRamCost(
    source: string,
    costs: Map<string, number>,
): ScriptRamCost {
    if (costs.size === 0) {
        return { total: 0, entries: [] };
    }
    const found = new Map<string, number>();
    const re = /\b(\w+)\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(source)) !== null) {
        const name = m[1];
        if (found.has(name)) {
            continue;
        }
        const cost = costs.get(name);
        if (cost !== undefined) {
            found.set(name, cost);
        }
    }
    const entries: RamCostEntry[] = Array.from(found, ([name, cost]) => ({ name, cost }));
    // Highest cost first; alphabetical break tie so the modal list is stable.
    entries.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
    const total = entries.reduce((sum, e) => sum + e.cost, 0);
    return { total, entries };
}

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
