"""Run once via -ExecutePythonScript in a dedicated Unreal Editor session.

Only Unreal creates binary assets. Never replace an existing map. This script
is syntax-checked locally but has NOT run in Unreal until M1 evidence says so.
"""

import unreal


MAP_PATH = "/Game/Maps/L_Tutuba"


def create_starter_map():
    if unreal.EditorAssetLibrary.does_asset_exist(MAP_PATH):
        raise RuntimeError(f"Refusing to overwrite {MAP_PATH}. Open the existing map instead.")

    arena_class = unreal.load_class(None, "/Script/Tutuba.TutubaArena")
    if arena_class is None:
        raise RuntimeError("Build TutubaEditor and load its module before generating content.")

    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    # Keep the destination absent if actor creation fails. new_level(path)
    # would save an empty map immediately and prevent a safe retry.
    world = unreal.EditorLoadingAndSavingUtils.new_blank_map(False)
    if world is None:
        raise RuntimeError("Cannot create an unsaved starter world.")

    arena = actors.spawn_actor_from_class(arena_class, unreal.Vector(0, 0, 0))
    if arena is None:
        raise RuntimeError("Cannot spawn TutubaArena; inspect the Editor log.")
    arena.set_actor_label("Tutuba Arena — editable grid and camera")

    sun = actors.spawn_actor_from_class(
        unreal.DirectionalLight, unreal.Vector(350, 350, 700), unreal.Rotator(-55, -30, 0)
    )
    if sun is None:
        raise RuntimeError("Cannot spawn key light.")
    sun.set_actor_label("Warm Key Light")
    sun_component = sun.get_component_by_class(unreal.DirectionalLightComponent)
    sun_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    sun_component.set_editor_property("intensity", 3.0)
    sun_component.set_light_color(unreal.LinearColor(1.0, 0.88, 0.72))

    fill = actors.spawn_actor_from_class(
        unreal.DirectionalLight, unreal.Vector(350, 350, 500), unreal.Rotator(-40, 150, 0)
    )
    if fill is None:
        raise RuntimeError("Cannot spawn fill light.")
    fill.set_actor_label("Cool Fill — no shadows")
    fill_component = fill.get_component_by_class(unreal.DirectionalLightComponent)
    fill_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    fill_component.set_editor_property("intensity", 0.8)
    fill_component.set_editor_property("cast_shadows", False)
    fill_component.set_light_color(unreal.LinearColor(0.62, 0.78, 1.0))

    if not unreal.EditorLoadingAndSavingUtils.save_map(world, MAP_PATH):
        raise RuntimeError(f"Cannot save {MAP_PATH}; inspect the Editor log.")
    unreal.log(f"TUTUBA_M1_MAP_SAVED: {MAP_PATH}; one arena, 36 tile instances, two lights.")


if __name__ == "__main__":
    create_starter_map()
