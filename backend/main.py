import io
import threading
import time
from typing import Any, Dict, List, Optional
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image, ImageOps
from pydantic import BaseModel

app = FastAPI(
    title="RapidOCR e-KTP Extraction API",
    description="High-speed e-KTP OCR backend using RapidOCR (ONNXRuntime)",
    version="1.0.0",
)

# CORS configuration to allow local Vite development and custom origins
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB limit matching frontend validator
_ocr_engine = None
_engine_lock = threading.Lock()

def get_ocr_engine():
    """Lazily initialize the RapidOCR engine to avoid slow import on startup."""
    global _ocr_engine
    if _ocr_engine is None:
        with _engine_lock:
            if _ocr_engine is None:
                try:
                    from rapidocr_onnxruntime import RapidOCR

                    _ocr_engine = RapidOCR()
                except Exception as exc:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Inisialisasi RapidOCR gagal: {str(exc)}. Pastikan rapidocr-onnxruntime terinstall.",
                    ) from exc
    return _ocr_engine


class HealthResponse(BaseModel):
    status: str
    service: str
    engine: str
    version: str


class KtpOcrResponse(BaseModel):
    success: bool
    boxes: List[List[List[float]]]
    txts: List[str]
    scores: List[float]
    raw_text: str
    det_ms: float
    rec_ms: float
    total_ms: float


@app.get("/api/health", response_model=HealthResponse)
def health_check() -> Dict[str, Any]:
    """Health check endpoint to test backend server connectivity."""
    return {
        "status": "ok",
        "service": "rapidocr-fastapi",
        "engine": "rapidocr-onnxruntime",
        "version": "1.0.0",
    }


@app.post("/api/v1/ocr/extract-ktp", response_model=KtpOcrResponse)
async def extract_ktp(file: UploadFile = File(...)) -> Dict[str, Any]:
    """
    Extract text and bounding boxes from uploaded e-KTP image using RapidOCR.
    Returns raw text, coordinate boxes, confidence scores, and latency metrics.
    """
    # 1. Validate content type if provided
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"File harus berupa gambar, diterima: {file.content_type}",
        )

    # 2. Read image bytes with max-size guard and guaranteed file handle closure
    try:
        contents = await file.read(MAX_UPLOAD_SIZE_BYTES + 1)
        if not contents:
            raise HTTPException(status_code=400, detail="File gambar kosong.")
        if len(contents) > MAX_UPLOAD_SIZE_BYTES:
            raise HTTPException(
                status_code=413,
                detail="Ukuran file melebihi batas maksimal 10 MB.",
            )

        image = Image.open(io.BytesIO(contents))
        # Transpose according to EXIF orientation (mobile phone photos)
        image = ImageOps.exif_transpose(image)
        # Ensure RGB format for RapidOCR
        if image.mode != "RGB":
            image = image.convert("RGB")
        image_np = np.array(image)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Gagal memproses file gambar: {str(exc)}",
        ) from exc
    finally:
        await file.close()
    # 3. Execute RapidOCR engine with latency profiling
    t_start = time.perf_counter()
    engine = get_ocr_engine()

    try:
        ocr_result, elapse_list = engine(image_np)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Gagal menjalankan inferensi OCR: {str(exc)}",
        ) from exc

    t_end = time.perf_counter()
    total_ms = round((t_end - t_start) * 1000, 2)

    # Parse RapidOCR elapse_list (typically [det_time, cls_time, rec_time] in seconds)
    det_ms = 0.0
    rec_ms = 0.0
    if elapse_list:
        try:
            val0 = float(elapse_list[0])
            det_ms = round(val0 * 1000 if val0 < 20 else val0, 2)
            val_rec = float(elapse_list[-1])
            rec_ms = round(val_rec * 1000 if val_rec < 20 else val_rec, 2)
        except (IndexError, ValueError, TypeError):
            det_ms = round(total_ms * 0.3, 2)
            rec_ms = round(total_ms * 0.7, 2)

    boxes: List[List[List[float]]] = []
    txts: List[str] = []
    scores: List[float] = []

    if ocr_result:
        for item in ocr_result:
            # item is [box, text, score]
            if len(item) >= 3:
                box_coords, text, score = item[0], item[1], item[2]
                boxes.append(
                    [[float(coord[0]), float(coord[1])] for coord in box_coords]
                )
                txts.append(str(text))
                scores.append(round(float(score), 4))

    raw_text = "\n".join(txts)

    return {
        "success": True,
        "boxes": boxes,
        "txts": txts,
        "scores": scores,
        "raw_text": raw_text,
        "det_ms": det_ms,
        "rec_ms": rec_ms,
        "total_ms": total_ms,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
