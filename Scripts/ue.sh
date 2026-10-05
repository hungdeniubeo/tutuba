#!/bin/bash
# Native macOS arm64 Unreal commands. Arguments are always passed literally.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"
PROJECT="$PROJECT_DIR/Tutuba.uproject"
COMMAND="${1:-check}"
if [[ $# -gt 0 ]]; then shift; fi

case "$COMMAND" in
    check) exec python3 "$SCRIPT_DIR/check_environment.py" "$@" ;;
    build-editor|bootstrap|editor|package) ;;
    *) printf 'Usage: bash Scripts/ue.sh check [--json] | build-editor | bootstrap | editor | package\n' >&2; exit 2 ;;
esac
if [[ $# -ne 0 ]]; then
    printf 'Unexpected arguments. Set UE_ROOT to choose an engine installation.\n' >&2
    exit 2
fi

# Keep JSON exact; never run the parser through a command-output formatter.
if ! REPORT="$(python3 "$SCRIPT_DIR/check_environment.py" --json)"; then
    printf '%s\n' "$REPORT" | python3 -c 'import json, sys; r=json.load(sys.stdin); print("Tutuba preflight blocked:", file=sys.stderr); [print("- " + item, file=sys.stderr) for item in r["blockers"]]'
    exit 1
fi
ENGINE_ROOT="$(printf '%s\n' "$REPORT" | python3 -c 'import json, sys; print(json.load(sys.stdin)["engine"]["root"])')"
EDITOR="$ENGINE_ROOT/Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor"
if [[ ! -f "$PROJECT" ]]; then
    printf 'Project descriptor not found: %s\n' "$PROJECT" >&2
    exit 1
fi

case "$COMMAND" in
    build-editor)
        exec "$ENGINE_ROOT/Engine/Build/BatchFiles/Mac/Build.sh" TutubaEditor Mac Development \
            "-project=$PROJECT" -WaitMutex -architecture=arm64
        ;;
    bootstrap)
        exec "$EDITOR" "$PROJECT" /Engine/Maps/Entry \
            "-ExecutePythonScript=$SCRIPT_DIR/Editor/create_starter_map.py" -ScriptErrorsAreFatal -unattended -nosplash
        ;;
    editor)
        exec "$EDITOR" "$PROJECT" /Game/Maps/L_Tutuba
        ;;
    package)
        if [[ ! -f "$PROJECT_DIR/Content/Maps/L_Tutuba.umap" ]]; then
            printf 'Starter map is missing. Run bash Scripts/ue.sh bootstrap before packaging.\n' >&2
            exit 1
        fi
        exec "$ENGINE_ROOT/Engine/Build/BatchFiles/RunUAT.sh" BuildCookRun \
            "-project=$PROJECT" -noP4 -platform=Mac -clientconfig=Shipping \
            -build -cook -stage -pak -archive -architecture=arm64 \
            "-archivedirectory=$PROJECT_DIR/Builds/Mac"
        ;;
esac
