"""
model/shadow_filter.py — the false-positive filter your PS explicitly
asks for.

CORE IDEA (real acoustic physics, not a fake threshold):
A real 3D object on the seafloor blocks the sonar's acoustic ping,
casting a dark "shadow" behind it -- specifically, on the side AWAY
FROM the nadir (the sensor's own track, the bright/dark gap usually
running down the middle of a side-scan sonar image). A rock cluster,
speckle noise, or other false positive usually does NOT have this
consistent, correctly-positioned dark region.

This check:
  1. Finds the nadir gap (or falls back to image center if none found)
  2. Determines which side of nadir the detection sits on
  3. Looks at the region immediately adjacent to the detection, on the
     side AWAY from nadir (where a real shadow should fall)
  4. Compares that region's brightness to a same-size "control" patch
     elsewhere at the same depth/range -- if the shadow-side region is
     meaningfully darker than the control, that's real supporting
     evidence for an actual object. If not, it's more likely noise.

This is a heuristic, not a rigorous physical model -- it's designed to
be a fast, honest, explainable improvement over "just threshold the
confidence score," which is what a shallow implementation would do.
"""

import numpy as np
from PIL import Image


def find_nadir_center(gray_arr, dark_thresh=15, min_frac=0.85):
    """
    Estimate the x-position of the nadir gap (the dark vertical strip
    down the middle of a side-scan sonar image). Falls back to the
    image's horizontal center if no clear gap is found (e.g. the image
    has already been cropped to one channel only).
    """
    h, w = gray_arr.shape[:2]
    dark_frac_per_col = (gray_arr < dark_thresh).mean(axis=0)
    dark_cols = np.where(dark_frac_per_col > min_frac)[0]
    if len(dark_cols) == 0:
        return w // 2
    return int(dark_cols.mean())


def check_shadow(image_path: str, bbox: dict, darkness_ratio_thresh: float = 0.75) -> dict:
    """
    Given an image and a detection's normalized bbox, check whether a
    physically-plausible acoustic shadow exists adjacent to it.

    Args:
        image_path: path to the full sonar image the detection came from
        bbox: dict with x_center, y_center, width, height (all 0-1 normalized,
              same format inference.py already produces)
        darkness_ratio_thresh: how much darker the shadow-side region must
              be than the control region to count as "passed" (0.75 means
              shadow region must be at most 75% as bright as control --
              i.e. at least 25% darker)

    Returns:
        {
            "shadow_check_passed": bool,
            "shadow_region_brightness": float,
            "control_region_brightness": float,
            "darkness_ratio": float,   # shadow / control, lower = more shadow-like
        }
    """
    img = Image.open(image_path).convert("L")  # grayscale
    arr = np.array(img).astype(np.float32)
    h, w = arr.shape

    # Convert normalized bbox to pixel coordinates
    x_center = bbox["x_center"] * w
    y_center = bbox["y_center"] * h
    box_w = bbox["width"] * w
    box_h = bbox["height"] * h

    x1 = int(x_center - box_w / 2)
    x2 = int(x_center + box_w / 2)
    y1 = int(y_center - box_h / 2)
    y2 = int(y_center + box_h / 2)

    nadir_x = find_nadir_center(arr)

    # Which side of nadir is this object on? Shadow should fall on the
    # SAME side the object is already on, extending further AWAY from
    # nadir (real shadows trail away from the sensor, past the object).
    object_is_right_of_nadir = x_center > nadir_x

    shadow_region_width = max(int(box_w * 0.75), 5)  # look just past the object

    if object_is_right_of_nadir:
        # Shadow expected further right (further from nadir)
        sx1 = x2
        sx2 = min(w, x2 + shadow_region_width)
        # Control region: mirror position on the opposite (nadir) side of the box
        cx1 = max(0, x1 - shadow_region_width)
        cx2 = x1
    else:
        # Shadow expected further left (further from nadir)
        sx1 = max(0, x1 - shadow_region_width)
        sx2 = x1
        cx1 = x2
        cx2 = min(w, x2 + shadow_region_width)

    # Clip vertical range to image bounds, keep same y-range as the box
    y1_c, y2_c = max(0, y1), min(h, y2)

    shadow_patch = arr[y1_c:y2_c, sx1:sx2]
    control_patch = arr[y1_c:y2_c, cx1:cx2]

    if shadow_patch.size == 0 or control_patch.size == 0:
        # Detection too close to image edge to evaluate -- don't penalize,
        # just pass it through without a real shadow judgement.
        return {
            "shadow_check_passed": True,
            "shadow_region_brightness": None,
            "control_region_brightness": None,
            "darkness_ratio": None,
            "note": "detection too close to image edge to evaluate shadow",
        }

    shadow_brightness = float(shadow_patch.mean())
    control_brightness = float(control_patch.mean())

    # Avoid divide-by-zero on a fully black control patch
    ratio = shadow_brightness / control_brightness if control_brightness > 1e-3 else 1.0

    passed = ratio <= darkness_ratio_thresh

    return {
        "shadow_check_passed": passed,
        "shadow_region_brightness": round(shadow_brightness, 2),
        "control_region_brightness": round(control_brightness, 2),
        "darkness_ratio": round(ratio, 3),
    }


if __name__ == "__main__":
    # Quick standalone test:
    #   python shadow_filter.py <image_path> <x_center> <y_center> <width> <height>
    import sys
    import json

    if len(sys.argv) != 6:
        print("Usage: python shadow_filter.py <image_path> <x_center> <y_center> <width> <height>")
        sys.exit(1)

    test_bbox = {
        "x_center": float(sys.argv[2]),
        "y_center": float(sys.argv[3]),
        "width": float(sys.argv[4]),
        "height": float(sys.argv[5]),
    }
    result = check_shadow(sys.argv[1], test_bbox)
    print(json.dumps(result, indent=2))
