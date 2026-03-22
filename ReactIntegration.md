# React Integration Guide - Face Affectus

This guide explains how to connect your React frontend to the Face Affectus FastAPI backend.

## 1. Start the Backend
```bash
# In the Face-Affectus directory
uvicorn main:app --reload
```
The API will be available at `http://localhost:8000`.

## 2. React Example (Webcam Capture)

You can use a library like `react-webcam` or a native `video` element with a `canvas` to capture frames.

```javascript
import React, { useRef, useState, useEffect } from 'react';

const EmotionDetector = () => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const [result, setResult] = useState(null);

    const captureAndAnalyze = async () => {
        const canvas = canvasRef.current;
        const video = videoRef.current;
        
        // Draw current video frame to canvas
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        
        // Convert canvas to Blob
        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('file', blob, 'capture.jpg');

            try {
                const response = await fetch('http://localhost:8000/analyze', {
                    method: 'POST',
                    body: formData,
                });
                const data = await response.json();
                setResult(data.results);
            } catch (error) {
                console.error("Error analyzing image:", error);
            }
        }, 'image/jpeg');
    };

    // Run interval every 1 second
    useEffect(() => {
        const interval = setInterval(captureAndAnalyze, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div>
            <video ref={videoRef} autoPlay style={{ width: '480px' }} />
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div>
                <h3>Detection Results:</h3>
                <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>
        </div>
    );
};

export default EmotionDetector;
```

## 3. Key Endpoints
- **GET `/`**: Welcome message.
- **POST `/analyze`**: Expects a multipart form-data file named `file`. Returns JSON results.
- **Docs**: Visit `http://localhost:8000/docs` for the interactive API documentation.
