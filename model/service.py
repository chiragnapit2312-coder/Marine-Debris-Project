"""
service.py — the tiny HTTP wrapper around inference.py, since the
backend is Java (Spring Boot) and can't import a Python function
directly. This exposes run_detection() as one HTTP endpoint that Java
calls like any external API.

Run this with:
    pip install fastapi uvicorn python-multipart ultralytics
    uvicorn service:app --host 0.0.0.0 --port 8000

Java backend then calls:
    POST http://localhost:8000/detect   (multipart/form-data, field name "image")

Response is a JSON list of detections -- exactly what run_detection()
returns, no reshaping done here. Backend is responsible for adding
lat/lon and shadow_check_passed before sending anything to frontend.
"""

import shutil
import tempfile
import os
import time

from fastapi import FastAPI, UploadFile, File, HTTPException

from inference import run_detection
from shadow_filter import check_shadow

app = FastAPI(title="Ghost Net Detector - Model Microservice")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/detect")
async def detect(image: UploadFile = File(...)):
    """
    Accepts an uploaded image file, runs the model on it, and returns
    detections with shadow_check_passed and processing_time_seconds
    already attached. Java backend still needs to add lat/lon.
    """
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be an image.")

    suffix = os.path.splitext(image.filename or "upload.jpg")[1] or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        shutil.copyfileobj(image.file, tmp)
        tmp_path = tmp.name

    try:
        start_time = time.perf_counter()
        detections = run_detection(tmp_path)
        processing_time = round(time.perf_counter() - start_time, 4)

        for det in detections:
            shadow_result = check_shadow(tmp_path, det["bbox"])
            det["shadow_check_passed"] = shadow_result["shadow_check_passed"]

        return {
            "image_id": image.filename,
            "detections": detections,
            "processing_time_seconds": processing_time,
        }
    finally:
        os.remove(tmp_path)
