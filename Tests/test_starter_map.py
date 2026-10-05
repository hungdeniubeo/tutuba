"""Control-flow tests with an Unreal API double; these do NOT validate UE APIs."""

import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch


class StarterMapTests(unittest.TestCase):
    def setUp(self):
        self.unreal = MagicMock()
        self.unreal.EditorAssetLibrary.does_asset_exist.return_value = False
        self.world = self.unreal.EditorLoadingAndSavingUtils.new_blank_map.return_value
        spec = importlib.util.spec_from_file_location(
            "starter_map", Path(__file__).resolve().parents[1] / "Scripts/Editor/create_starter_map.py"
        )
        self.script = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, unreal=self.unreal):
            spec.loader.exec_module(self.script)

    def test_actor_failure_never_saves_a_partial_map(self):
        self.unreal.get_editor_subsystem.return_value.spawn_actor_from_class.side_effect = RuntimeError("spawn failed")
        with self.assertRaisesRegex(RuntimeError, "spawn failed"):
            self.script.create_starter_map()
        self.unreal.get_editor_subsystem.return_value.new_level.assert_not_called()
        self.unreal.EditorLoadingAndSavingUtils.save_map.assert_not_called()

    def test_existing_map_is_never_replaced(self):
        self.unreal.EditorAssetLibrary.does_asset_exist.return_value = True
        with self.assertRaisesRegex(RuntimeError, "Refusing to overwrite"):
            self.script.create_starter_map()
        self.unreal.EditorLoadingAndSavingUtils.new_blank_map.assert_not_called()
        self.unreal.EditorLoadingAndSavingUtils.save_map.assert_not_called()

    def test_populated_world_is_saved_once(self):
        def save_after_actors(world, path):
            self.assertEqual(self.unreal.get_editor_subsystem.return_value.spawn_actor_from_class.call_count, 3)
            return True

        self.unreal.EditorLoadingAndSavingUtils.save_map.side_effect = save_after_actors
        self.script.create_starter_map()
        self.unreal.EditorLoadingAndSavingUtils.new_blank_map.assert_called_once_with(False)
        self.unreal.EditorLoadingAndSavingUtils.save_map.assert_called_once_with(self.world, "/Game/Maps/L_Tutuba")

    def test_save_failure_is_reported(self):
        self.unreal.EditorLoadingAndSavingUtils.save_map.return_value = False
        with self.assertRaisesRegex(RuntimeError, "Cannot save"):
            self.script.create_starter_map()


if __name__ == "__main__":
    unittest.main()
