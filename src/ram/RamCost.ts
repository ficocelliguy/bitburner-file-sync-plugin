// Local, definition-scraping RAM cost helpers.
//
// The status bar total comes from the server (see RamCostTracker calling
// `api.calculateRam`) — that's the authoritative number. This file exists to
// power the *breakdown* the user sees when they click the status bar: an
// approximate per-method attribution built by scraping `@remarks RAM cost:
// X GB` markers out of the workspace's NetscriptDefinitions.d.ts and
// matching them against identifiers in the active file. Approximation is
// acceptable here — the same false-positive shape Bitburner accepts (a
// `hack` variable name counting as `ns.hack`) is fine for a click-through
// diagnostic.

export interface RamCostEntry {
    name: string;
    cost: number;
}

export interface ScriptRamCost {
    total: number;
    entries: RamCostEntry[];
}

// Flat base charge every Netscript-using script pays (see
// `RamCostConstants.Base` in bitburner-src/src/Netscript/RamCostGenerator.ts).
// Kept as an exported constant so both the total and the breakdown-modal
// last-line entry stay in sync.
export const BASE_RAM_COST = 1.6;
export const BASE_COST_LABEL = 'Base cost';

// TypeScript-declaration keywords that can appear immediately after a JSDoc
// block. Filtering these out prevents a JSDoc on an interface/class/type
// header from attaching its documented cost to the enclosing keyword when
// the RAM cost marker sits in prose rather than on a real method.
const DECLARATION_KEYWORDS = new Set([
    'export', 'interface', 'class', 'type', 'enum', 'namespace',
    'declare', 'function', 'const', 'let', 'var', 'abstract',
    'readonly', 'public', 'private', 'protected', 'static',
    'async',
]);

// Extract method-name → RAM-cost pairs from NetscriptDefinitions.d.ts.
//
// Anchors on JSDoc blocks so the "RAM cost: X GB" marker inside the comment
// is paired with the declaration that follows. Duplicate names (e.g.
// `getServer` on both NS and Darknet) resolve to the higher cost — the
// per-file scan is flat, so overestimating is safer than underestimating
// for a user-facing breakdown.
export function parseRamCosts(source: string): Map<string, number> {
    const result = new Map<string, number>();
    // /**  ...  */  name  ( | ? | <
    // Content uses `[^*]|\*(?!\/)` rather than a lazy `[\s\S]*?` so the
    // regex engine cannot expand a failing match across intervening `*/`
    // closers: otherwise a prose "RAM cost: X GB" in an interface-level
    // JSDoc would spill onto the enclosed methods.
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
    return result;
}

// Sum unique ns method identifiers appearing in `source`.
//
// Only counts identifiers reached via a property accessor — `.name` (dot,
// including `?.name` optional chaining) or `["name"]` / `['name']` (string
// bracket key). Bare identifiers (`const hack = 1`) and identifiers that
// happen to appear inside string literals (`ns.exec("grow.js")`) are
// ignored, which keeps the estimate closer to what the game actually
// counts. It's still an approximation — false positives inside comments or
// `.name`-shaped substrings of string literals can slip through — but the
// common script-argument case ("grow.js", "hack.js", filenames-as-strings)
// no longer contributes phantom costs.
export function computeScriptRamCost(
    source: string,
    costs: Map<string, number>,
): ScriptRamCost {
    if (costs.size === 0) {
        return { total: 0, entries: [] };
    }
    const found = new Map<string, number>();
    const record = (name: string): void => {
        if (found.has(name)) {
            return;
        }
        const cost = costs.get(name);
        if (cost !== undefined) {
            found.set(name, cost);
        }
    };
    // Dot accessor: matches `.name`, `?.name`, and `.name` inside chains.
    // `\w+` greedily consumes the whole identifier so `growthAnalyze` is a
    // single token, and the map lookup requires an exact key hit — a
    // `grow` cost entry cannot spuriously match `.growthAnalyze`.
    const dotAccessor = /\.(\w+)/g;
    // String-keyed bracket accessor: `["name"]` / `['name']`, tolerating
    // whitespace inside the brackets. Numeric keys and non-quoted keys are
    // deliberately excluded — numeric keys can't reach ns methods and
    // non-quoted keys are variable indirection we can't statically resolve.
    const bracketAccessor = /\[\s*["'](\w+)["']\s*\]/g;

    let m: RegExpExecArray | null;
    while ((m = dotAccessor.exec(source)) !== null) {
        record(m[1]);
    }
    while ((m = bracketAccessor.exec(source)) !== null) {
        record(m[1]);
    }
    const entries: RamCostEntry[] = Array.from(found, ([name, cost]) => ({ name, cost }));
    // Highest cost first; alphabetical break tie so the modal list is stable.
    entries.sort((a, b) => b.cost - a.cost || a.name.localeCompare(b.name));
    // Append the base charge as the last row so the breakdown mirrors the
    // game's own accounting: every ns-using script pays the flat base on
    // top of its identified methods. Only added when at least one method
    // was detected — an empty scan should stay empty so the status bar
    // hides for non-scripts and prose files.
    if (entries.length > 0) {
        entries.push({ name: BASE_COST_LABEL, cost: BASE_RAM_COST });
    }
    const total = entries.reduce((sum, e) => sum + e.cost, 0);
    return { total, entries };
}

// Render a GB figure at the resolution the game uses (hundredth-of-a-GB).
// Always pads to two decimal places to match Bitburner's own display style
// (`0.00 GB`, `1.60 GB`, `2.50 GB`) rather than trimming trailing zeros —
// makes column alignment predictable and matches user expectations from
// the in-game UI.
export function formatRam(gb: number): string {
    if (!Number.isFinite(gb)) {
        return '?? GB';
    }
    // Round *before* formatting: `.toFixed(2)` alone reads the binary
    // representation, so values like 0.155 land at "0.15" instead of the
    // expected "0.16". Multiplying by 100, rounding, and dividing back
    // shifts the rounding boundary out of the float-precision noise.
    const rounded = Math.round(gb * 100) / 100;
    return `${rounded.toFixed(2)} GB`;
}
