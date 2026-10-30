// scripts/server-only-shim.cjs
// Stand-in for the `server-only` package when running Stage 5C
// integration tests under Node directly. The real package throws
// when imported outside a React Server Components context; this
// shim is a no-op because the test script is not a client bundle.
module.exports = {};
