#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/tutuba-combat-core.XXXXXX")"
trap 'rm -rf -- "$TEST_DIR"' EXIT
COMPILER="${CXX:-clang++}"
"$COMPILER" -std=c++17 -Wall -Wextra -Werror -pedantic \
    -I "$ROOT/Source/Tutuba/Public" \
    "$ROOT/Tests/TutubaCombatCoreTests.cpp" \
    "$ROOT/Source/Tutuba/Private/TutubaCombatModel.cpp" \
    -o "$TEST_DIR/TutubaCombatCoreTests"
"$TEST_DIR/TutubaCombatCoreTests"
