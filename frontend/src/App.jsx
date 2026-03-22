import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { 
  Camera, RefreshCw, LayoutDashboard, BrainCircuit, Check, 
  Play, Pause, RotateCcw, Shield, ShieldOff, 
  Mic, MicOff, Video, VideoOff, MonitorUp, MoreVertical, 
  PhoneOff, Users, MessageSquare, Info, Settings,
  SquareTerminal
} from 'lucide-react';
import { useBackgroundBlur } from './hooks/useBackgroundBlur';
import './App.css';

const App = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [results, setResults] = useState([]);
  const [allSessionResults, setAllSessionResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  
  // New UI states
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const webcamRef = useRef(null);
  const canvasRef = useRef(null);

  const { processFrame } = useBackgroundBlur(
    webcamRef.current?.video,
    canvasRef.current,
    isBlurEnabled
  );

  // Time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDevices = useCallback(
    mediaDevices =>
      setDevices(mediaDevices.filter(({ kind }) => kind === 'videoinput')),
    [setDevices]
  );

  const requestPermissionAndRefresh = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      handleDevices(mediaDevices);
    } catch (err) {
      console.error("Permission denied or error:", err);
    }
  };

  useEffect(() => {
    requestPermissionAndRefresh();
  }, []);

  // Animation loop for MediaPipe processing
  useEffect(() => {
    let requestRef;
    const animate = async () => {
      await processFrame();
      requestRef = requestAnimationFrame(animate);
    };
    if (selectedDevice && isCamEnabled) {
      requestRef = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef);
  }, [selectedDevice, isCamEnabled, processFrame]);

  const saveSessionToBackend = async (finalResults) => {
    if (finalResults.length === 0) return;
    const sid = sessionId || `session_${Date.now()}`;
    try {
      await fetch('http://localhost:8000/save-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sid,
          results: finalResults
        }),
      });
    } catch (error) {
      console.error("Failed to save session:", error);
    }
  };

  const capture = useCallback(async () => {
    if (canvasRef.current && isCamEnabled) {
      const imageSrc = canvasRef.current.toDataURL('image/jpeg');
      if (!imageSrc) return;

      const blob = await (await fetch(imageSrc)).blob();
      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');

      try {
        const response = await fetch('http://localhost:8000/analyze', {
          method: 'POST',
          body: formData,
        });
        const data = await response.json();
        const frameResults = data.results || [];
        setResults(frameResults);
        
        if (frameResults.length > 0) {
          setAllSessionResults(prev => [...prev, ...frameResults]);
        }
      } catch (error) {
        console.error("Backend connection failed:", error);
      }
    }
  }, [canvasRef, isCamEnabled]);

  useEffect(() => {
    let interval;
    if (isAnalyzing && selectedDevice && isCamEnabled) {
      interval = setInterval(capture, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing, selectedDevice, isCamEnabled, capture]);

  const toggleAnalysis = () => {
    if (isAnalyzing) {
      saveSessionToBackend(allSessionResults);
    } else {
      setAllSessionResults([]);
      setSessionId(`session_${Date.now()}`);
    }
    setIsAnalyzing(!isAnalyzing);
  };

  const resetCall = () => {
    if (isAnalyzing) saveSessionToBackend(allSessionResults);
    setSelectedDevice(null);
    setIsAnalyzing(false);
    setResults([]);
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!selectedDevice) {
    return (
      <div className="selection-view">
        <div className="selection-card glass-card">
          <div className="logo-group" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '2rem' }}>
            <BrainCircuit size={40} color="#8ab4f8" />
            <h1 style={{ margin: 0, fontSize: '1.8rem' }}>Face Affectus <span style={{ color: '#8ab4f8' }}>AI</span></h1>
          </div>
          
          <h2 style={{ marginBottom: '1rem' }}>Ready to join?</h2>
          <p style={{ color: '#bdc1c6', marginBottom: '2rem' }}>Select your primary camera device to start the emotion detection session.</p>
          
          <div className="camera-grid">
            {devices.map((device, key) => (
              <div 
                key={key} 
                className={`camera-card glass-card ${selectedDevice === device.deviceId ? 'active' : ''}`}
                onClick={() => setSelectedDevice(device.deviceId)}
              >
                <p>{device.label || `Camera ${key + 1}`}</p>
              </div>
            ))}
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <button className="btn-secondary" onClick={requestPermissionAndRefresh} style={{ background: 'transparent', border: '1px solid #4e5256', padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
              <RefreshCw size={18} style={{ marginRight: '8px' }} />
              Refresh
            </button>
            <button 
              className="btn-primary" 
              disabled={!selectedDevice}
              onClick={() => setSelectedDevice(selectedDevice)}
              style={{ background: '#8ab4f8', color: '#202124', border: 'none', padding: '0.8rem 2rem', borderRadius: '8px', fontWeight: 'bold', cursor: selectedDevice ? 'pointer' : 'not-allowed' }}
            >
              Join Meeting
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="meeting-container">
      {/* Room Content (Interview Layout) */}
      <main className="room-content">
        <div className="interview-layout">
          {/* Candidate View (Large) */}
          <div className="candidate-view">
            {isCamEnabled ? (
              <div className="video-wrapper" style={{ width: '100%', height: '100%' }}>
                <Webcam
                  key={selectedDevice}
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ deviceId: { exact: selectedDevice }, width: 1280, height: 720 }}
                  style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                />
                <canvas ref={canvasRef} width={1280} height={720} className="webcam-feed" />
              </div>
            ) : (
              <div className="peer-avatar">Candidate</div>
            )}
            
            <div className="candidate-name">
              <span>Candidate</span>
            </div>

            {results.length > 0 && isCamEnabled && isAnalyzing && (
              <div className="emotion-badge">
                {results[0].emotion}
              </div>
            )}
          </div>

          {/* Recruiter PiP (Small) */}
          <div className="recruiter-pip">
            {isCamEnabled ? (
              <Webcam
                audio={false}
                videoConstraints={{ deviceId: { exact: selectedDevice }, width: 640, height: 360 }}
                className="webcam-feed"
                mirrored={true}
              />
            ) : (
              <div className="peer-avatar" style={{ fontSize: '1rem', width: '40px', height: '40px' }}>R</div>
            )}
            <div className="pip-label">
              {isMicEnabled ? <Mic size={10} /> : <MicOff size={10} color="#ea4335" />}
              <span style={{ marginLeft: '4px' }}>You (Recruiter)</span>
            </div>
          </div>
        </div>
      </main>

      {/* Control Bar */}
      <footer className="control-bar">
        <div className="meeting-details">
          <span className="time-str">{formatTime(currentTime)}</span>
          <span style={{ color: '#bdc1c6', fontSize: '0.9rem' }}>Meeting Room | Affectus</span>
        </div>

        <div className="action-buttons">
          <button 
            className={`round-btn ${!isMicEnabled ? 'danger' : ''}`}
            onClick={() => setIsMicEnabled(!isMicEnabled)}
          >
            {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>
          
          <button 
            className={`round-btn ${!isCamEnabled ? 'danger' : ''}`}
            onClick={() => setIsCamEnabled(!isCamEnabled)}
          >
            {isCamEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>

          <button 
            className={`round-btn ${isAnalyzing ? 'active' : ''}`}
            onClick={toggleAnalysis}
            title={isAnalyzing ? "Stop Analysis" : "Start Emotion Analysis"}
          >
            <BrainCircuit size={20} />
          </button>

          <button 
            className={`round-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={() => setIsScreenSharing(!isScreenSharing)}
          >
            <MonitorUp size={20} />
          </button>

          <div style={{ position: 'relative' }}>
            <button 
              className="round-btn"
              onClick={() => setShowMoreMenu(!showMoreMenu)}
            >
              <MoreVertical size={20} />
            </button>

            {/* More Menu (Settings) - Relative to button */}
            {showMoreMenu && (
              <div className="more-menu">
                <div className="menu-item" onClick={() => { setIsBlurEnabled(!isBlurEnabled); setShowMoreMenu(false); }}>
                  {isBlurEnabled ? <ShieldOff size={20} /> : <Shield size={20} />}
                  <span>{isBlurEnabled ? "Disable Privacy Mode" : "Enable Privacy Mode"}</span>
                </div>
                <div className="menu-divider" />
                <div className="menu-item" onClick={() => { setSelectedDevice(null); setShowMoreMenu(false); }}>
                  <RotateCcw size={20} />
                  <span>Change Camera</span>
                </div>
                <div className="menu-item">
                  <LayoutDashboard size={20} />
                  <span>Session Stats</span>
                </div>
              </div>
            )}
          </div>

          <button className="round-btn danger" onClick={resetCall}>
            <PhoneOff size={20} />
          </button>
        </div>

        <div className="sidebar-actions">
          <button className="round-btn" style={{ background: 'transparent', border: 'none' }}><Info size={20} /></button>
          <button className="round-btn" style={{ background: 'transparent', border: 'none' }}><Users size={20} /></button>
          <button className="round-btn" style={{ background: 'transparent', border: 'none' }}><MessageSquare size={20} /></button>
          <button className="round-btn" style={{ background: 'transparent', border: 'none' }}><Settings size={20} /></button>
        </div>
      </footer>
    </div>
  );
};

export default App;
