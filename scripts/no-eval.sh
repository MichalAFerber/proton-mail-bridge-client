#!/usr/bin/env bash
# TGWAB eval gate—DEV-STANDARDS §2.
#
# Place at:  scripts/no-eval.sh   ·   CI:  ./scripts/no-eval.sh dist
#
# The §12 CSP never carries 'unsafe-eval', which blocks eval(), new Function(),
# bare Function("…"), and string-form setTimeout/setInterval/setImmediate. Anything
# this finds is code that will throw at runtime for a real user.
#
# Runs against BUILT output, not source: esbuild preserves the `eval` identifier
# through minification, so the check survives bundling.
#
# Escape hatch (§2): a vendor file that genuinely cannot be made eval-free goes in
# .eval-allowlist as a path prefix with a one-line reason, AND as a README deviation.
# The CSP MUST NOT be loosened instead.
set -euo pipefail

TARGET="${1:-dist}"
ALLOW=".eval-allowlist"

PATTERN='(^|[^A-Za-z0-9_$])eval[[:space:]]*\(|new[[:space:]]+Function[[:space:]]*\(|(^|[^A-Za-z0-9_$.])Function[[:space:]]*\([[:space:]]*["'"'"'`]|set(Timeout|Interval|Immediate)[[:space:]]*\([[:space:]]*["'"'"'`]'

hits="$(grep -nEr "$PATTERN" \
  --include='*.js' --include='*.mjs' --include='*.cjs' --include='*.html' \
  "$TARGET" || true)"

if [ -s "$ALLOW" ]; then
  hits="$(printf '%s\n' "$hits" \
    | grep -vFf <(grep -v '^[[:space:]]*#' "$ALLOW" | grep -v '^[[:space:]]*$') || true)"
fi

if [ -n "$hits" ]; then
  printf '::error::runtime code-generation found in %s (CSP has no %s)\n' "$TARGET" "'unsafe-eval'"
  printf '%s\n' "$hits"
  exit 1
fi

printf 'eval-free: OK (%s)\n' "$TARGET"
