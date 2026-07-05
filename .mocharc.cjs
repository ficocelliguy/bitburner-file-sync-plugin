// IDE-focused Mocha config, auto-picked up by IntelliJ IDEA / VS Code so
// per-test green-arrow runs work directly against the TypeScript sources.
// The npm scripts (`test`, `test:unit`) pass `--config .mocharc.unit.json`
// explicitly and use the compiled `out/` tree instead.
module.exports = {
    spec: 'src/test/unit/**/*.test.ts',
    require: ['ts-node/register', 'src/test/unit/setup.ts'],
    ui: 'tdd',
    timeout: 10000,
    reporter: 'spec',
};
