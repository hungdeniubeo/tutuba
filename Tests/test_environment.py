"""Guard tests; fake engine tools do not validate Unreal compilation."""

import importlib.util
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
CHECKER = ROOT / "Scripts/check_environment.py"
WRAPPER = ROOT / "Scripts/ue.sh"


def load_checker():
    spec = importlib.util.spec_from_file_location("check_environment", CHECKER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_executable(path, content):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)
    path.chmod(0o755)


def make_engine(root):
    """Filesystem fixture for the unavailable UE installation."""
    files = (
        "Engine/Build/BatchFiles/Mac/Build.sh",
        "Engine/Build/BatchFiles/RunUAT.sh",
        "Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor",
    )
    for name in files:
        write_executable(root / name, "#!/bin/sh\nexit 0\n")
    version = root / "Engine/Build/Build.version"
    version.write_text(json.dumps({"MajorVersion": 5, "MinorVersion": 8, "PatchVersion": 0}))
    return root


class EngineDiscoveryTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(CHECKER.is_file(), "The environment checker is not implemented")
        self.checker = load_checker()
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name).resolve()

    def test_missing_engine_returns_search_evidence(self):
        location = self.directory / "Epic Games"
        result = self.checker.find_engine(None, [location])
        self.assertIsNone(result["root"])
        self.assertTrue(result["error"])
        self.assertIn(str(location), result["searched"])

    def test_invalid_explicit_root_does_not_fall_back_to_installed_engine(self):
        location = self.directory / "Epic Games"
        make_engine(location / "UE_5.8")
        bad_root = self.directory / "typo"
        result = self.checker.find_engine(str(bad_root), [location])
        self.assertIsNone(result["root"])
        self.assertIn("UE_ROOT", result["error"])
        self.assertEqual(result["searched"], [str(bad_root)])

    def test_empty_explicit_root_is_invalid(self):
        result = self.checker.find_engine("", [self.directory])
        self.assertIsNone(result["root"])
        self.assertTrue(result["error"])

    def test_explicit_root_with_spaces_is_preserved(self):
        engine = make_engine(self.directory / "Unreal Engine 5.8")
        result = self.checker.find_engine(str(engine), [])
        self.assertEqual(result["root"], str(engine))
        self.assertEqual(result["version"], "5.8.0")
        self.assertIsNone(result["error"])

    def test_incomplete_engine_cannot_pass_preflight(self):
        engine = make_engine(self.directory / "UE_5.8")
        (engine / "Engine/Build/BatchFiles/RunUAT.sh").unlink()
        result = self.checker.find_engine(str(engine), [])
        self.assertIsNone(result["root"])
        self.assertIn("RunUAT.sh", result["error"])

    def test_wrong_engine_minor_version_is_rejected(self):
        engine = make_engine(self.directory / "UE_5.7")
        (engine / "Engine/Build/Build.version").write_text(
            json.dumps({"MajorVersion": 5, "MinorVersion": 7, "PatchVersion": 0})
        )
        self.assertIsNone(self.checker.find_engine(str(engine), [])["root"])

    def test_clt_only_host_is_blocked_and_reports_tool_probe(self):
        def clt_probe(command):
            outputs = {
                ("xcode-select", "-p"): (0, "/Library/Developer/CommandLineTools", ""),
                ("xcodebuild", "-version"): (1, "", "requires Xcode"),
                ("xcrun", "--find", "metal"): (1, "", "unable to find utility metal"),
            }
            code, stdout, stderr = outputs.get(tuple(command), (0, "unknown", ""))
            return {"command": command, "returncode": code, "stdout": stdout, "stderr": stderr}

        with mock.patch.object(self.checker, "run_probe", side_effect=clt_probe), \
                mock.patch.object(self.checker.platform, "system", return_value="Darwin"), \
                mock.patch.object(self.checker.platform, "machine", return_value="arm64"), \
                mock.patch.object(self.checker.platform, "mac_ver", return_value=("26.7.1", (), "")):
            report = self.checker.collect_report(str(self.directory / "absent"), [])
        self.assertFalse(report["ready"])
        self.assertTrue(any("full Xcode" in item for item in report["blockers"]))
        self.assertTrue(any("Metal" in item for item in report["blockers"]))
        self.assertEqual(report["xcode"]["developer_directory"], "/Library/Developer/CommandLineTools")


@unittest.skipUnless(platform.system() == "Darwin" and platform.machine() == "arm64",
                     "Successful wrapper fixture needs the target macOS arm64 host")
class WrapperTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(WRAPPER.is_file(), "The Unreal wrapper is not implemented")
        self.assertTrue(CHECKER.is_file(), "The environment checker is not implemented")
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name).resolve()
        self.project = self.directory / "Project with spaces"
        scripts = self.project / "Scripts"
        scripts.mkdir(parents=True)
        shutil.copy2(CHECKER, scripts / CHECKER.name)
        shutil.copy2(WRAPPER, scripts / WRAPPER.name)
        (self.project / "Tutuba.uproject").write_text("{}")
        (scripts / "Editor").mkdir()
        (scripts / "Editor/create_starter_map.py").write_text("# fixture\n")
        self.engine = make_engine(self.directory / "Engine $(touch INJECTED) with spaces")
        self.calls = self.directory / "calls.json"
        recorder = "#!" + sys.executable + "\nimport json, os, sys\nfrom pathlib import Path\n" \
                   "Path(os.environ['TOOL_CALLS']).write_text(json.dumps(sys.argv))\n" \
                   "sys.exit(int(os.environ.get('TOOL_EXIT', '0')))\n"
        for tool in (
            "Engine/Build/BatchFiles/Mac/Build.sh",
            "Engine/Build/BatchFiles/RunUAT.sh",
            "Engine/Binaries/Mac/UnrealEditor.app/Contents/MacOS/UnrealEditor",
        ):
            write_executable(self.engine / tool, recorder)
        self.bin = self.directory / "fixture-bin"
        self.developer = self.directory / "Xcode.app/Contents/Developer"
        self.developer.mkdir(parents=True)
        metal = self.bin / "metal"
        write_executable(metal, "#!/bin/sh\nexit 0\n")
        for command, output in (
            ("xcode-select", str(self.developer)),
            ("xcodebuild", "Xcode 26.1.1\nBuild version 17B100"),
            ("xcrun", str(metal)),
        ):
            write_executable(self.bin / command,
                             "#!" + sys.executable + "\nprint(" + repr(output) + ")\n")
        self.environment = dict(os.environ, UE_ROOT=str(self.engine), TOOL_CALLS=str(self.calls),
                                PATH=str(self.bin) + os.pathsep + os.environ["PATH"])

    def run_wrapper(self, command, **overrides):
        environment = dict(self.environment, **overrides)
        return subprocess.run(["bash", str(self.project / "Scripts/ue.sh"), command],
                              cwd=self.directory, env=environment, text=True, capture_output=True)

    def test_build_keeps_paths_literal_and_requests_arm64(self):
        result = self.run_wrapper("build-editor")
        self.assertEqual(result.returncode, 0, result.stderr)
        arguments = json.loads(self.calls.read_text())
        self.assertEqual(arguments[1:4], ["TutubaEditor", "Mac", "Development"])
        self.assertIn("-project=" + str(self.project / "Tutuba.uproject"), arguments)
        self.assertIn("-architecture=arm64", arguments)
        self.assertFalse((self.directory / "INJECTED").exists())

    def test_missing_engine_stops_before_build(self):
        result = self.run_wrapper("build-editor", UE_ROOT=str(self.directory / "missing"))
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("UE_ROOT", result.stderr + result.stdout)
        self.assertFalse(self.calls.exists())

    def test_clt_only_stops_before_editor(self):
        write_executable(self.bin / "xcode-select",
                         "#!/bin/sh\nprintf '%s\\n' /Library/Developer/CommandLineTools\n")
        result = self.run_wrapper("editor")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("full Xcode", result.stderr + result.stdout)
        self.assertFalse(self.calls.exists())

    def test_unsupported_xcode_stops_before_build(self):
        for version in ("25.0", "26.4"):
            with self.subTest(version=version):
                write_executable(self.bin / "xcodebuild",
                                 "#!/bin/sh\nprintf '%s\\n' 'Xcode " + version + "'\n")
                result = self.run_wrapper("build-editor")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("Xcode", result.stderr)
                self.assertFalse(self.calls.exists())

    def test_check_json_has_blockers_and_failing_exit_status(self):
        environment = dict(self.environment, UE_ROOT=str(self.directory / "missing"))
        result = subprocess.run(["bash", str(self.project / "Scripts/ue.sh"), "check", "--json"],
                                env=environment, text=True, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        report = json.loads(result.stdout)
        self.assertFalse(report["ready"])
        self.assertTrue(report["blockers"])

    def test_bootstrap_uses_execute_python_script(self):
        result = self.run_wrapper("bootstrap")
        self.assertEqual(result.returncode, 0, result.stderr)
        arguments = json.loads(self.calls.read_text())
        self.assertIn("-ExecutePythonScript=" + str(self.project / "Scripts/Editor/create_starter_map.py"), arguments)
        self.assertIn("-unattended", arguments)
        self.assertIn("-ScriptErrorsAreFatal", arguments)
        self.assertFalse(any(item.startswith("-ExecCmd") for item in arguments))

    def test_packaging_requires_created_map(self):
        result = self.run_wrapper("package")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("bootstrap", result.stderr)
        self.assertFalse(self.calls.exists())

    def test_package_preserves_archive_path_and_propagates_failure(self):
        map_file = self.project / "Content/Maps/L_Tutuba.umap"
        map_file.parent.mkdir(parents=True)
        map_file.touch()
        result = self.run_wrapper("package", TOOL_EXIT="9")
        self.assertEqual(result.returncode, 9, result.stderr)
        arguments = json.loads(self.calls.read_text())
        self.assertIn("BuildCookRun", arguments)
        self.assertIn("-archivedirectory=" + str(self.project / "Builds/Mac"), arguments)
        self.assertIn("-clientconfig=Shipping", arguments)

    def test_check_emits_parseable_json_without_tool_invocation(self):
        result = subprocess.run(["bash", str(self.project / "Scripts/ue.sh"), "check", "--json"],
                                env=self.environment, text=True, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(json.loads(result.stdout)["ready"])
        self.assertFalse(self.calls.exists())


if __name__ == "__main__":
    unittest.main()
