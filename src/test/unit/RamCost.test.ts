import { strict as assert } from 'assert';
import { computeScriptRamCost, formatRam, parseRamCosts } from '../../ram/RamCost';

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
        const costs = parseRamCosts(src);
        assert.equal(costs.get('hack'), 0.1);
    });

    test('extracts cost from the inline "@remarks RAM cost: X GB" form', () => {
        const src = `
/**
 * @remarks RAM cost: 2 GB
 */
getSymbols(): string[];
`;
        const costs = parseRamCosts(src);
        assert.equal(costs.get('getSymbols'), 2);
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
        const costs = parseRamCosts(src);
        assert.equal(costs.get('optional'), 1);
        assert.equal(costs.get('generic'), 2);
        assert.equal(costs.get('plain'), 3);
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
        const costs = parseRamCosts(src);
        assert.equal(costs.get('export'), undefined);
        assert.equal(costs.get('interface'), undefined);
        assert.equal(costs.get('doThing'), 0.5);
    });

    test('resolves duplicate method names to the higher cost', () => {
        // Different API groups sometimes reuse a method name. The calculator
        // scans identifiers flatly, so overestimating is safer than under.
        const src = `
/** @remarks RAM cost: 0.1 GB */
getServer(): number;
/** @remarks RAM cost: 2 GB */
getServer(): object;
`;
        const costs = parseRamCosts(src);
        assert.equal(costs.get('getServer'), 2);
    });

    test('skips methods whose JSDoc has no RAM cost marker', () => {
        const src = `
/** Just a description, no cost documented. */
mystery(): void;
`;
        const costs = parseRamCosts(src);
        assert.equal(costs.get('mystery'), undefined);
        assert.equal(costs.size, 0);
    });

    test('skips property declarations (colon-form)', () => {
        // Property declarations end with `:` rather than `?`, `<`, or `(`.
        // The parser filters those out so a RAM-cost-tagged interface field
        // never attaches its cost to a data property name.
        const src = `
/** @remarks RAM cost: 5 GB */
someProperty: number;
`;
        const costs = parseRamCosts(src);
        assert.equal(costs.get('someProperty'), undefined);
    });
});

suite('computeScriptRamCost', () => {
    const costs = new Map<string, number>([
        ['hack', 0.1],
        ['grow', 0.15],
        ['weaken', 0.15],
        ['getServerMoneyAvailable', 0.1],
        ['scan', 0.2],
        ['write', 0],
    ]);

    test('returns empty when the cost table has no entries', () => {
        const result = computeScriptRamCost('ns.hack("home")', new Map());
        assert.deepEqual(result, { total: 0, entries: [] });
    });

    test('sums each unique identifier exactly once', () => {
        // Two calls to hack() should still contribute 0.1 GB, not 0.2 GB —
        // uniqueness by name is the whole point.
        const src = `
export async function main(ns) {
    await ns.hack("n00dles");
    await ns.hack("foodnstuff");
    await ns.grow("n00dles");
}`;
        const result = computeScriptRamCost(src, costs);
        assert.equal(result.total, 0.1 + 0.15);
        assert.deepEqual(result.entries.map(e => e.name).sort(), ['grow', 'hack']);
    });

    test('sorts entries highest cost first, alphabetical as tiebreaker', () => {
        const src = 'ns.hack(); ns.grow(); ns.weaken(); ns.scan();';
        const result = computeScriptRamCost(src, costs);
        assert.deepEqual(result.entries, [
            { name: 'scan', cost: 0.2 },
            { name: 'grow', cost: 0.15 },
            { name: 'weaken', cost: 0.15 },
            { name: 'hack', cost: 0.1 },
        ]);
    });

    test('includes zero-cost identifiers when they are detected', () => {
        // A file that only touches free methods should still trigger the
        // status bar so the user sees "RAM: 0 GB" rather than a hidden item.
        const result = computeScriptRamCost('ns.write("a")', costs);
        assert.equal(result.total, 0);
        assert.deepEqual(result.entries, [{ name: 'write', cost: 0 }]);
    });

    test('detects identifiers without knowing the enclosing namespace', () => {
        // The scanner is flat by design — a stray `hack` variable name
        // still counts. Documented as a "false positives OK" tradeoff.
        const src = 'const hack = 1; console.log(hack);';
        const result = computeScriptRamCost(src, costs);
        assert.deepEqual(result.entries, [{ name: 'hack', cost: 0.1 }]);
    });
});

suite('formatRam', () => {
    test('trims trailing zeros', () => {
        assert.equal(formatRam(0), '0 GB');
        assert.equal(formatRam(2), '2 GB');
        assert.equal(formatRam(2.5), '2.5 GB');
        assert.equal(formatRam(1.75), '1.75 GB');
    });

    test('rounds to hundredth-of-a-GB (Bitburner\'s granularity)', () => {
        assert.equal(formatRam(0.155), '0.16 GB');
        assert.equal(formatRam(1.234), '1.23 GB');
    });

    test('renders NaN/Infinity as a visible fallback rather than a broken number', () => {
        assert.equal(formatRam(NaN), '?? GB');
        assert.equal(formatRam(Infinity), '?? GB');
    });
});
