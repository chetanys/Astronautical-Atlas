#!/usr/bin/env python3
"""Export an assembled Perseverance Blender scene to a web-ready GLB file."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=Path("assets/perseverance.glb"))
    blender_args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(blender_args)

    mesh_objects = [
        obj for obj in bpy.context.scene.objects if obj.type == "MESH"
    ]
    if not mesh_objects:
        raise RuntimeError("The source Blender scene contains no mesh objects.")

    fallback_texture = None
    for image in bpy.data.images:
        if image.source == "FILE" and image.packed_file is None:
            image_path = Path(bpy.path.abspath(image.filepath))
            if not image_path.is_file():
                if image.name == "environment.hdr":
                    continue
                if fallback_texture is None:
                    fallback_texture = bpy.data.images.new(
                        "Missing texture fallback",
                        width=1,
                        height=1,
                        alpha=True,
                    )
                    fallback_texture.pixels = [0.5, 0.5, 1.0, 1.0]
                    fallback_texture.colorspace_settings.name = "Non-Color"
                    fallback_texture.pack()
                for material in bpy.data.materials:
                    if not material.use_nodes:
                        continue
                    for node in material.node_tree.nodes:
                        if node.type == "TEX_IMAGE" and node.image == image:
                            node.image = fallback_texture
                print(
                    f"Warning: missing source texture {image.filepath!r}; "
                    "using a neutral fallback."
                )
                continue
            try:
                image.pack()
            except RuntimeError as error:
                raise RuntimeError(
                    f"Could not pack texture {image.name!r}; make sure source textures "
                    "are available before exporting."
                ) from error

    bpy.ops.object.select_all(action="DESELECT")
    for obj in mesh_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_objects[0]

    args.output.parent.mkdir(parents=True, exist_ok=True)
    result = bpy.ops.export_scene.gltf(
        filepath=str(args.output.resolve()),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
    )
    if "FINISHED" not in result:
        raise RuntimeError(f"Blender GLB export failed: {result}")

    print(
        f"Exported {len(mesh_objects)} rover mesh objects to "
        f"{args.output} ({args.output.stat().st_size:,} bytes)."
    )


if __name__ == "__main__":
    main()
