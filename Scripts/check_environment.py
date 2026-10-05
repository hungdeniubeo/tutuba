#!/usr/bin/env python3
"""Read-only, standard-library preflight for Tutuba's macOS arm64 target."""

import argparse
import json
import os
from pathlib import Path
import platform
import re
import shutil
import subprocess
import sys


PROJECT_ROOT = Path(__file__).resolve().parents[1]
ENGINE_FILES = (
    "Engine/Build/BatchFiles/Mac/Build.sh",
    "Engine/Build/BatchFiles/RunUAT.sh",
    "Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor",
    "Engine/Build/Build.version",
)


def run_probe(command):
    """Only call allowlisted, read-only tools; never invoke a shell."""
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=15)
        return {"command": command, "returncode": result.returncode,
                "stdout": result.stdout.strip(), "stderr": result.stderr.strip()}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"command": command, "returncode": 1, "stdout": "", "stderr": str(error)}


def find_engine(explicit_root=None, search_locations=None):
    """An explicit root is authoritative; discovery never overrides it."""
    locations = search_locations if search_locations is not None else [
        Path("/Users/Shared/Epic Games"), Path("/Applications/Epic Games"),
        Path("/Applications"), Path.home() / "Epic Games",
    ]
    result = {"root": None, "version": None, "source": "UE_ROOT" if explicit_root is not None else "standard locations",
              "searched": [], "error": None}
    if explicit_root is not None:
        if not explicit_root.strip():
            result["error"] = "UE_ROOT is empty; set it to the Unreal Engine 5.8 installation directory."
            return result
        candidates = [Path(explicit_root).expanduser().resolve()]
        result["searched"] = [str(candidates[0])]
    else:
        candidates = []
        for location in locations:
            location = Path(location)
            result["searched"].append(str(location))
            candidates.extend(sorted(location.glob("UE_5.8*"), reverse=True))
    failures = []
    for candidate in candidates:
        missing = [name for name in ENGINE_FILES if not (candidate / name).is_file()]
        if missing:
            failures.append(str(candidate) + ": missing " + ", ".join(missing))
            continue
        try:
            version = json.loads((candidate / "Engine/Build/Build.version").read_text())
            numbers = tuple(version[key] for key in ("MajorVersion", "MinorVersion", "PatchVersion"))
            if numbers[:2] != (5, 8):
                failures.append(str(candidate) + ": expected UE 5.8, found " + ".".join(map(str, numbers)))
                continue
        except (OSError, ValueError, KeyError, TypeError) as error:
            failures.append(str(candidate) + ": cannot read Build.version: " + str(error))
            continue
        result.update(root=str(candidate.resolve()), version=".".join(map(str, numbers)))
        return result
    prefix = "Invalid UE_ROOT. " if explicit_root is not None else "Unreal Engine 5.8 was not found. "
    result["error"] = prefix + ("; ".join(failures) if failures else "Set UE_ROOT to its installation directory.")
    return result


def collect_report(explicit_root=None, search_locations=None):
    blockers, warnings = [], []
    system = {"os": platform.system(), "macos_version": platform.mac_ver()[0],
              "architecture": platform.machine()}
    if system["os"] != "Darwin":
        blockers.append("This project targets macOS; run these commands on the target Mac.")
    if system["architecture"] != "arm64":
        blockers.append("Run in a native arm64 terminal/Python environment on Apple Silicon.")
    hardware = {}
    hardware_probes = []
    if system["os"] == "Darwin":
        for name, key in (("model", "hw.model"), ("chip", "machdep.cpu.brand_string"),
                          ("memory_bytes", "hw.memsize")):
            probe = run_probe(["sysctl", "-n", key])
            hardware_probes.append(probe)
            value = probe["stdout"] if probe["returncode"] == 0 else None
            hardware[name] = int(value) if name == "memory_bytes" and value and value.isdigit() else value
    hardware["probes"] = hardware_probes
    disk = {"path": str(PROJECT_ROOT), "free_bytes": shutil.disk_usage(PROJECT_ROOT).free}
    if disk["free_bytes"] < 50 * 1024 ** 3:
        warnings.append("Less than 50 GiB free at the project path; engine, build and package space requirements vary.")

    selected = run_probe(["xcode-select", "-p"])
    version_probe = run_probe(["xcodebuild", "-version"])
    metal_probe = run_probe(["xcrun", "--find", "metal"])
    developer = selected["stdout"] if selected["returncode"] == 0 else None
    version_match = re.search(r"^Xcode (\d+(?:\.\d+)*)", version_probe["stdout"], re.MULTILINE)
    version = version_match.group(1) if version_match and version_probe["returncode"] == 0 else None
    metal = metal_probe["stdout"] if metal_probe["returncode"] == 0 else None
    xcode = {"developer_directory": developer, "version": version, "metal_path": metal,
             "probes": [selected, version_probe, metal_probe]}
    if not developer or not developer.endswith(".app/Contents/Developer") or not Path(developer).is_dir() or not version:
        blockers.append("Select a full Xcode installation; Command Line Tools alone cannot build this UE project.")
    if version:
        parts = tuple(int(part) for part in version.split("."))
        if parts < (26, 0):
            blockers.append("Unreal Engine 5.8 requires Xcode 26.0 or newer; proposed baseline is 26.1.1.")
        elif parts[:2] == (26, 4):
            blockers.append("Xcode 26.4 is incompatible with Unreal Engine 5.8 according to Epic's requirements.")
        elif version != "26.1.1":
            warnings.append("Xcode differs from the proposed 26.1.1 baseline; confirm compatibility with a native build.")
    if not metal or not Path(metal).is_file():
        blockers.append("Metal compiler is unavailable through xcrun; install/enable the Xcode Metal toolchain.")
    engine = find_engine(explicit_root, search_locations)
    if engine["error"]:
        blockers.append(engine["error"])
    return {"ready": not blockers, "system": system, "hardware": hardware, "disk": disk,
            "xcode": xcode, "engine": engine, "blockers": blockers, "warnings": warnings,
            "recommended": {"unreal_engine": "5.8", "xcode": "26.1.1"},
            "note": "Preflight checks availability only. Toolchain compatibility and project correctness require an actual native Unreal build."}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Print a JSON report, including blockers and probe evidence")
    parser.add_argument("--ue-root", help="Explicit Unreal Engine directory; overrides UE_ROOT")
    arguments = parser.parse_args()
    explicit_root = arguments.ue_root if arguments.ue_root is not None else os.environ.get("UE_ROOT")
    report = collect_report(explicit_root)
    if arguments.json:
        print(json.dumps(report, indent=2))
    else:
        print("Tutuba environment: " + ("prerequisites found" if report["ready"] else "blocked"))
        print("System: {os} {macos_version}, {architecture}".format(**report["system"]))
        print("Hardware: {} / {} / {} bytes RAM".format(
            report["hardware"].get("model"), report["hardware"].get("chip"), report["hardware"].get("memory_bytes")))
        print("Free disk: {:.1f} GiB at {}".format(report["disk"]["free_bytes"] / 1024 ** 3, report["disk"]["path"]))
        print("Xcode: {} at {}".format(report["xcode"]["version"], report["xcode"]["developer_directory"]))
        print("Metal: {}".format(report["xcode"]["metal_path"]))
        print("Unreal Engine: {} at {}".format(report["engine"]["version"], report["engine"]["root"]))
        print("Searched: " + ", ".join(report["engine"]["searched"]))
        for label, key in (("BLOCKER", "blockers"), ("WARNING", "warnings")):
            for message in report[key]:
                print(label + ": " + message)
        print(report["note"])
        print("Use --json for exact probe commands and results.")
    return 0 if report["ready"] else 1


if __name__ == "__main__":
    sys.exit(main())
