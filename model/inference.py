"""
inference.py — the one function that turns "a trained checkpoint" into
"something anyone can call."
 
run_detection(image_path) -> list[dict]
 
Deliberately does ONLY this: image in, raw detections out. No JSON
formatting, no lat/lon, no shadow filtering -- those are separate
concerns (service.py, geotagging in Java backend, and shadow_filter.py
respectively). Keeping this narrow means it's easy to test standalone
and easy for anyone else to trust.
"""
 
from ultralytics import YOLO
from class_map import class_name
import os
 
# Loaded once, at import time -- NOT reloaded on every call, since
# loading a YOLO checkpoint from disk is relatively slow and this
# function may be called many times per second by the wrapper service.
#
# Path is built relative to THIS FILE's location, not the current
# working directory -- so this works correctly no matter where/how
# uvicorn is launched from (a common, hard-to-debug footgun otherwise).
_MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "weights", "best.pt")
_model = YOLO(_MODEL_PATH)
 
 
def run_detection(image_path: str, confidence_threshold: float = 0.25) -> list[dict]:
    """
    Run the trained YOLO model on a single image and return a list of
    detections in a clean, library-agnostic format.
 
    Each returned dict has exactly this shape:
        {
            "class_id": int,
            "class": str,              # human-readable name, e.g. "fishing_net"
            "confidence": float,        # 0.0 - 1.0
            "bbox": {
                "x_center": float,      # normalized 0-1, NOT pixels
                "y_center": float,      # normalized 0-1, NOT pixels
                "width": float,         # normalized 0-1, NOT pixels
                "height": float,        # normalized 0-1, NOT pixels
            }
        }
 
    Normalized (0-1) coordinates are used deliberately -- this is what
    YOLO produces natively, and it's what the geotagging math on the
    backend expects. Never convert these to raw pixel coordinates here.
    """
    results = _model.predict(source=image_path, conf=confidence_threshold, verbose=False)
 
    detections = []
    for result in results:
        boxes = result.boxes
        if boxes is None:
            continue
        for box in boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            # box.xywhn = normalized [x_center, y_center, width, height]
            x_center, y_center, width, height = box.xywhn[0].tolist()
 
            detections.append({
                "class_id": class_id,
                "class": class_name(class_id),
                "confidence": round(confidence, 4),
                "bbox": {
                    "x_center": round(x_center, 6),
                    "y_center": round(y_center, 6),
                    "width": round(width, 6),
                    "height": round(height, 6),
                },
            })
 
    return detections
 
 
if __name__ == "__main__":
    # Quick standalone test: run this file directly with an image path
    # to sanity-check the model loads and produces sensible output,
    # before handing anything to the backend team.
    #   python inference.py path/to/test_image.jpg
    import sys
    import json
 
    if len(sys.argv) != 2:
        print("Usage: python inference.py <image_path>")
        sys.exit(1)
 
    result = run_detection(sys.argv[1])
    print(json.dumps(result, indent=2))
 
