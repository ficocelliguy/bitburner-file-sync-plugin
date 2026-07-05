"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = require("assert");
const RamCost_1 = require("../../ram/RamCost");
suite('formatRam', () => {
    test('trims trailing zeros', () => {
        assert_1.strict.equal((0, RamCost_1.formatRam)(0), '0 GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(2), '2 GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(2.5), '2.5 GB');
        assert_1.strict.equal((0, RamCost_1.formatRam)(1.75), '1.75 GB');
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