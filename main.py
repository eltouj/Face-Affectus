import base64
import os
import json
from datetime import datetime
from typing import List
from pydantic import BaseModel
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from functions.emotion_engine import EmotionEngine

app = FastAPI(title="Face Affectus API")

# Enable CORS for React integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, set this to your React app's URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize the modular emotion engine
engine = EmotionEngine()

@app.get("/")
async def root():
    return {"message": "Face Affectus API is running"}

import cv2
import numpy as np

# Ensure history directory exists
HISTORY_DIR = "history"
if not os.path.exists(HISTORY_DIR):
    os.makedirs(HISTORY_DIR)

class DetectionResult(BaseModel):
    emotion: str
    box: List[int]

class SessionData(BaseModel):
    session_id: str
    results: List[DetectionResult]

@app.post("/save-session")
async def save_session(data: SessionData):
    """
    Saves a list of detection results into a JSON file for analysis.
    """
    try:
        filename = f"{data.session_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        filepath = os.path.join(HISTORY_DIR, filename)
        
        with open(filepath, 'w') as f:
            json.dump(data.json(), f, indent=4)
            
        return {"message": "Session saved successfully", "file": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze")
async def analyze_image(file: UploadFile = File(...)):
    """
    Receives an image file and returns detected emotions and bounding boxes.
    """
    try:
        # Read the uploaded file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            raise HTTPException(status_code=400, detail="Invalid image format")

        # Process frame using the engine
        # We don't need the annotated frame here, just the results
        _, results = engine.process_frame(frame)

        return {"results": results}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
