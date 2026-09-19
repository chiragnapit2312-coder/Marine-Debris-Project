"""
CLASS_MAP as a Python dict, mirroring CLASS_MAP.txt exactly.
Used by inference.py to convert YOLO's numeric class IDs into
human-readable class names before sending anything to backend.

IMPORTANT: if CLASS_MAP.txt ever changes (new class added, renamed,
etc.), update this file to match -- they must never drift apart.
"""

CLASS_MAP = {
    0: "ball",
    1: "circle cage",
    2: "cube",
    3: "cylinder",
    4: "human body",
    5: "metal bucket",
    6: "plane",
    7: "rov",
    8: "square cage",
    9: "tyre",
    10: "ship",
    11: "aircraft",
    12: "human",
    13: "fishing_net",
    14: "cylinder_chip",
    15: "iron_pipeline",
    16: "floats",
    17: "small_propeller",
    18: "big_propeller",
    19: "soft_pipeline",
    20: "pipeline_or_cable",
    21: "seabed_surface",
    22: "underwater_residual_mound",
    23: "engineering_platform",
    24: "fish",
}


def class_name(class_id: int) -> str:
    """Look up a class name by ID, with a safe fallback instead of a crash
    if an unexpected ID ever shows up (e.g. a class added to the model
    but not yet added here)."""
    return CLASS_MAP.get(class_id, f"unknown_class_{class_id}")
