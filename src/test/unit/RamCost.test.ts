import { strict as assert } from 'assert';
import { formatRam } from '../../ram/RamCost';

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
