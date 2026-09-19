import os
from ultralytics import YOLO

_MODEL_PATH = os.path.join(os.path.dirname(__file__), "weights", "best.pt")

# Agar custom best.pt file nahi milti, toh standard yolov8n.pt use karein
if not os.path.exists(_MODEL_PATH):
    print(f"WARNING: {_MODEL_PATH} not found. Falling back to default 'yolov8n.pt'")
    _MODEL_PATH = "yolov8n.pt"

_model = YOLO(_MODEL_PATH)

def run_detection(image_bytes):
    # Model inference logic
    results = _model(image_bytes)
    return results
