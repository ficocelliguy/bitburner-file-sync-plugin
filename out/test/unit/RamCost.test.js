"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const RamCost_1 = require("../../ram/RamCost");
suite('parseRamCosts', () => {
    test('extracts cost from the two-line "@remarks\\n RAM cost: X GB" form', () => {
        const src = `
/**
 * Runs the hack function.
 * @remarks
 * RAM cost: 0.1 GB
 */
hack(host: string): Promise<number>;
`;
        const costs = (0, RamCost_1.parseRamCosts)(src);
        assert_1.strict.equal(costs.get('hack'), 0.1);
    });
    test('extracts cost from the inline "@remarks RAM cost: X GB" form', () => {
        const src = `
/**
 * @remarks RAM cost: 2 GB
 */
getSymbols(): string[];
`;
        const costs = (0, RamCost_1.parseRamCosts)(src);
        assert_1.strict.equal(costs.get('getSymbols'), 2);
    });
    test('captures methods that are optional, generic, or plain-parameter', () => {
        const src = `
/** @remarks RAM cost: 1 GB */
optional?(): void;
/** @remarks RAM cost: 2 GB */
generic<T>(x: T): T;
/** @remarks RAM cost: 3 GB */
plain(x: number): number;
`;
        const costs = (0, RamCost_1.parseRamCosts)(src);
        assert_1.strict.equal(costs.get('optional'), 1);
        assert_1.strict.equal(costs.get('generic'), 2);
        assert_1.strict.equal(costs.get('plain'), 3);
    });
    test('ignores JSDoc that sits above an interface/class/type/export header', () => {
        // A stray "RAM cost" reference in a namespace-level doc must not
        // pin a cost to the reserved keyword that follows.
        const src = `
/**
 * Namespace docs sometimes reference @remarks RAM cost: 99 GB in prose.
 */
export interface Foo {
    /** @remarks RAM cost: 0.5 GB */
    doThing(): void;
}
`;
        const costs = (0, RamCost_1.parseRamCosts)(src);
        assert_1.strict.equal(costs.get('export'), undefined);
        assert_1.strict.equal(costs.get('interface'), undefined);
        assert_1.strict.equal(costs.get('doThing'), 0.5);
    });
    test('resolves duplicate method names to the higher cost', () => {
        // Different API groups sometimes reuse a method name. The scan is
        // flat, so overestimating is safer than underestimating.
        const src = `
/** @remarks RAM cost: 0.1 GB */
getServer(): number;
/** @remarks RAM cost: 2 GB */
getServer(): object;
`;
        const costs = (0, RamCost_1.parseRamCosts)(src);
        assert_1.strict.equal(costs.get('getServer'), 2);
    });
    test('skips methods whose JSDoc has no RAM cost marker', () => {
        const src = `
/** Just a description, no cost documented. */
mystery(): void;
`;
        const costs = (0, RamCost_1.parseRamCosts)(src);
        assert_1.strict.equal(costs.get('mystery'), undefined);
        assert_1.strict.equal(costs.size, 0);
    });
    test('skips property declarations (colon-form)', () => {
        // Property declarations end with `:` rather than `?`, `<`, or `(`.
        // The parser filters those out so a RAM-cost-tagged interface field
        // never attaches its cost to a data property name.
        const src = `
/** @remarks RAM cost: 5 GB */
someProperty: number;
`;
        const costs = (0, RamCost_1.parseRamCosts)(src);
        assert_1.strict.equal(costs.get('someProperty'), undefined);
    });
});
suite('computeScriptRamCost', () => {
    const costs = new Map([
        ['hack', 0.1],
        ['grow', 0.15],
        ['weaken', 0.15],
        ['getServerMoneyAvailable', 0.1],
        ['scan', 0.2],
        ['write', 0],
    ]);
    test('returns empty when the cost table has no entries', () => {
        const result = (0, RamCost_1.computeScriptRamCost)('ns.hack("home")', new Map());
        assert_1.strict.deepEqual(result, { total: 0, entries: [] });
    });
    test('sums each unique identifier exactly once and includes the base cost', () => {
        // Two calls to hack() should still contribute 0.1 GB, not 0.2 GB —
        // uniqueness by name is the whole point. And every ns-using script
        // pays the flat 1.6 GB base charge on top.
        const src = `
export async function main(ns) {
    await ns.hack("n00dles");
    await ns.hack("foodnstuff");
    await ns.grow("n00dles");
}`;
        const result = (0, RamCost_1.computeScriptRamCost)(src, costs);
        assert_1.strict.equal(result.total, 0.1 + 0.15 + RamCost_1.BASE_RAM_COST);
        assert_1.strict.deepEqual(result.entries.map(e => e.name), ['grow', 'hack', RamCost_1.BASE_COST_LABEL]);
    });
    test('sorts ns entries highest cost first, then appends Base cost last', () => {
        const src = 'ns.hack(); ns.grow(); ns.weaken(); ns.scan();';
        const result = (0, RamCost_1.computeScriptRamCost)(src, costs);
        assert_1.strict.deepEqual(result.entries, [
            { name: 'scan', cost: 0.2 },
            { name: 'grow', cost: 0.15 },
            { name: 'weaken', cost: 0.15 },
            { name: 'hack', cost: 0.1 },
            { name: RamCost_1.BASE_COST_LABEL, cost: RamCost_1.BASE_RAM_COST },
        ]);
    });
    test('includes zero-cost identifiers when they are detected (still triggers base cost)', () => {
        const result = (0, RamCost_1.computeScriptRamCost)('ns.write("a")', costs);
        assert_1.strict.equal(result.total, RamCost_1.BASE_RAM_COST);
        assert_1.strict.deepEqual(result.entries, [
            { name: 'write', cost: 0 },
            { name: RamCost_1.BASE_COST_LABEL, cost: RamCost_1.BASE_RAM_COST },
        ]);
    });
    test('does not append base cost when no ns methods were detected', () => {
        // Base cost belongs to ns-using scripts. A plain file that doesn't
        // touch the API stays at zero so the status bar can hide.
        const result = (0, RamCost_1.computeScriptRamCost)('const x = 42; console.log(x);', costs);
        assert_1.strict.deepEqual(result, { total: 0, entries: [] });
    });
    test('ignores bare identifiers — only property accessors count', () => {
        // A local variable named `hack` is not `ns.hack`. The accessor gate
        // (`.name` / `["name"]`) filters these out so an unrelated `const
        // hack = 1` doesn't inflate the estimate.
        const src = 'const hack = 1; console.log(hack);';
        const result = (0, RamCost_1.computeScriptRamCost)(src, costs);
        assert_1.strict.deepEqual(result, { total: 0, entries: [] });
    });
    test('counts identifiers reached via bracket-string accessor', () => {
        // Both quote styles and internal whitespace should work — this is
        // the same as `ns.hack` from the runtime's perspective.
        const src = 'ns["hack"]("home"); ns[ \'grow\' ]("home");';
        const result = (0, RamCost_1.computeScriptRamCost)(src, costs);
        assert_1.strict.deepEqual(result.entries.map(e => e.name), ['grow', 'hack', RamCost_1.BASE_COST_LABEL]);
    });
    test('counts identifiers reached via optional chaining (?.name)', () => {
        // `?.` still ends in `.`, so the dot-accessor regex matches. Real
        // scripts increasingly use optional chaining, so this must work.
        const src = 'ns?.hack?.("home");';
        const result = (0, RamCost_1.computeScriptRamCost)(src, costs);
        assert_1.strict.deepEqual(result.entries.map(e => e.name), ['hack', RamCost_1.BASE_COST_LABEL]);
    });
    test('does not count identifiers that appear only inside string literals', () => {
        // The user's motivating example: passing a filename to ns.exec that
        // happens to be a script named "grow.js" must not add the `grow`
        // cost. Only `.exec` (dot accessor) is charged.
        const src = 'ns.exec("grow.js", "home", 1);';
        const result = (0, RamCost_1.computeScriptRamCost)(src, costs);
        // exec isn't in this test's cost table, so nothing is counted.
        assert_1.strict.deepEqual(result, { total: 0, entries: [] });
    });
    test('does not count non-string bracket keys (variable indirection is out of scope)', () => {
        // `ns[method]` can't be statically resolved; only quoted-string
        // keys are accepted.
        const src = 'const method = "hack"; ns[method]("home");';
        const result = (0, RamCost_1.computeScriptRamCost)(src, costs);
        assert_1.strict.deepEqual(result, { total: 0, entries: [] });
    });
    test('matches whole identifiers only — a longer name does not trigger a shorter cost key', () => {
        // Regression guard: an ns method whose name contains a shorter cost
        // key as a substring (`growthAnalyze` includes `grow`) must not add
        // the shorter key's cost. The tokenizer greedily consumes the whole
        // identifier and the map lookup requires an exact hit, so `grow` is
        // never charged from a script that only uses `growthAnalyze`.
        const substringCosts = new Map([
            ['grow', 0.15],
            ['growthAnalyze', 1],
            ['hack', 0.1],
            ['hackAnalyze', 1],
        ]);
        const result = (0, RamCost_1.computeScriptRamCost)('ns.growthAnalyze(server, 2); ns.hackAnalyze(server);', substringCosts);
        const names = result.entries.map(e => e.name);
        assert_1.strict.deepEqual(names, ['growthAnalyze', 'hackAnalyze', RamCost_1.BASE_COST_LABEL]);
        // grow (0.15) and hack (0.1) must be absent from the total.
        assert_1.strict.equal(result.total, 1 + 1 + RamCost_1.BASE_RAM_COST);
    });
    test('does not match identifiers embedded inside a longer identifier', () => {
        // The classic "does substring bleed through" check: a script that
        // mentions `growthAnalyze` (and nothing else ns-shaped) must not
        // count `grow` at all — even the base cost stays out, because no
        // recognized ns method was found.
        const src = 'const growthAnalyzeResult = something.growthAnalyzeSecurity(x);';
        const substringCosts = new Map([['grow', 0.15]]);
        const result = (0, RamCost_1.computeScriptRamCost)(src, substringCosts);
        assert_1.strict.deepEqual(result, { total: 0, entries: [] });
    });
});
suite('formatRam', () => {
    test('always pads to two decimal places (matches Bitburner\'s in-game display)', () => {
        assert_1.strict.equal((0, RamCost_1.formatRam)(0), '0.00 GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(2), '2.00 GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(2.5), '2.50 GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(1.85), '1.85 GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(0.05), '0.05 GB');
    });
    test('rounds to hundredth-of-a-GB (Bitburner\'s granularity)', () => {
        assert_1.strict.equal((0, RamCost_1.formatRam)(0.155), '0.16 GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(1.234), '1.23 GB');
    });
    test('renders NaN/Infinity as a visible fallback rather than a broken number', () => {
        assert_1.strict.equal((0, RamCost_1.formatRam)(NaN), '?? GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(Infinity), '?? GB');
    });
});
//# sourceMappingURL=RamCost.test.js.map