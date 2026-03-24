import base64
import os
import json
from datetime import datetime
from typing import List
from pydantic import BaseModel
from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
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

# Signaling Manager for WebRTC
class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, room_id: str):
        await websocket.accept()
        if room_id not in self.active_connections:
            self.active_connections[room_id] = []
        self.active_connections[room_id].append(websocket)
        print(f"Client connected to room: {room_id}. Total in room: {len(self.active_connections[room_id])}")

    def disconnect(self, websocket: WebSocket, room_id: str):
        if room_id in self.active_connections:
            self.active_connections[room_id].remove(websocket)
            if not self.active_connections[room_id]:
                del self.active_connections[room_id]
        print(f"Client disconnected from room: {room_id}")

    async def broadcast(self, message: str, room_id: str, sender: WebSocket):
        if room_id in self.active_connections:
            for connection in self.active_connections[room_id]:
                if connection != sender:
                    await connection.send_text(message)

manager = ConnectionManager()

@app.websocket("/ws/{room_id}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str, client_id: str):
    await manager.connect(websocket, room_id)
    try:
        while True:
            data = await websocket.receive_text()
            # Relay signaling message to other peer in the same room
            await manager.broadcast(data, room_id, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket, room_id)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket, room_id)

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
