import React, { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { 
  Camera, RefreshCw, LayoutDashboard, BrainCircuit, Check, 
  Play, Pause, RotateCcw, Shield, ShieldOff, 
  Mic, MicOff, Video, VideoOff, MonitorUp, MoreVertical, 
  PhoneOff, Users, MessageSquare, 
  SquareTerminal, Send, X, UserCheck, VideoOff as VideoOffIcon,
  NotebookPen, StickyNote, LayoutGrid, Circle, MessageSquareText,
  Headphones, ChevronDown, Settings, Sparkles, Volume2,
  HelpCircle, Activity, ShieldCheck, User
} from 'lucide-react';
import { useBackgroundBlur } from './hooks/useBackgroundBlur';
import './App.css';

const App = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [mics, setMics] = useState([]);
  const [selectedMic, setSelectedMic] = useState(null);
  const [speakers, setSpeakers] = useState([]);
  const [selectedSpeaker, setSelectedSpeaker] = useState(null);
  const [results, setResults] = useState([]);
  const [allSessionResults, setAllSessionResults] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isBlurEnabled, setIsBlurEnabled] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  
  // New UI states
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCamEnabled, setIsCamEnabled] = useState(true);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Dropdown states for pre-join
  const [activeDropdown, setActiveDropdown] = useState(null); // 'mic', 'cam', 'speaker'

  // Chat states
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: 'Bonjour, la session va commencer.', sender: 'Candidat', time: new Date() }
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef(null);

  // Participants
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [participants] = useState([
    { id: 1, name: 'Vous (Recruteur)', role: 'Hôte', mic: true,  cam: true,  avatar: 'R' },
    { id: 2, name: 'Candidat',         role: 'Invité', mic: true,  cam: true,  avatar: 'C' },
  ]);

  // Notes
  const [isNotesOpen, setIsNotesOpen] = useState(false);
  const [notes, setNotes] = useState('');

  // Tools
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = useState(false);

  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenVideoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [currentSpeaker, setCurrentSpeaker] = useState("Recruteur");
  
  // WebRTC States
  const [remoteStream, setRemoteStream] = useState(null);
  const pcRef = useRef(null);
  const socketRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localCanvasRef = useRef(null); // Used to render blurred local webcam
  const pendingCandidates = useRef([]);
  const [isStreamReady, setIsStreamReady] = useState(false);
  
  // Role & Room detection from URL (e.g., ?role=candidate&room=123)
  const urlParams = new URLSearchParams(window.location.search);
  const role = urlParams.get('role') || 'hr'; 
  const roomID = urlParams.get('room') || 'demo-room';
  
  console.log(`[Component Mount] Role: ${role}, Room: ${roomID}`);

  const { processFrame, isLoaded } = useBackgroundBlur(
    webcamRef.current?.video,
    localCanvasRef.current,
    isBlurEnabled
  );

  // Time update
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleDevices = useCallback(
    mediaDevices => {
      const videoDevices = mediaDevices.filter(({ kind }) => kind === 'videoinput');
      const audioInputDevices = mediaDevices.filter(({ kind }) => kind === 'audioinput');
      const audioOutputDevices = mediaDevices.filter(({ kind }) => kind === 'audiooutput');
      
      console.log(`[Devices] Found ${videoDevices.length} cams, ${audioInputDevices.length} mics, ${audioOutputDevices.length} speakers`);
      
      setDevices(videoDevices);
      setMics(audioInputDevices);
      setSpeakers(audioOutputDevices);

      // Set defaults if not already set
      if (videoDevices.length > 0 && !selectedDevice) setSelectedDevice(videoDevices[0].deviceId);
      if (audioInputDevices.length > 0 && !selectedMic) setSelectedMic(audioInputDevices[0].deviceId);
      if (audioOutputDevices.length > 0 && !selectedSpeaker) setSelectedSpeaker(audioOutputDevices[0].deviceId);
    },
    [selectedDevice, selectedMic, selectedSpeaker]
  );

  const refreshDevices = useCallback(async () => {
    try {
      const mediaDevices = await navigator.mediaDevices.enumerateDevices();
      console.log(`[Devices] Enumerated ${mediaDevices.length} total devices.`);
      handleDevices(mediaDevices);
    } catch (err) {
      console.error("[Devices] Enumerate error:", err);
    }
  }, [handleDevices]);

  const requestPermissionAndRefresh = async () => {
    try {
      console.log("[Permission] Requesting camera/mic permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      console.log("[Permission] Granted. Cleaning up temporary stream.");
      stream.getTracks().forEach(track => track.stop());
      setPermissionGranted(true);
      await refreshDevices();
    } catch (err) {
      console.error("[Permission] Denied or error:", err);
    }
  };

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // Animation loop for MediaPipe processing + Canvas Drawing
  useEffect(() => {
    let requestRef;
    const animate = async () => {
      // 1. Process Local Webcam -> localCanvasRef
      const localVideo = webcamRef.current?.video;
      const isLocalReady = localVideo && localVideo.readyState >= 2 && localVideo.videoWidth > 0;
      if (isLocalReady) {
        if (isBlurEnabled && isLoaded) {
          await processFrame();
        } else if (localCanvasRef.current) {
          const lctx = localCanvasRef.current.getContext('2d');
          lctx.save();
          // The canvas CSS handles mirroring if not HR, but let's draw it directly
          lctx.drawImage(localVideo, 0, 0, localCanvasRef.current.width, localCanvasRef.current.height);
          lctx.restore();
        }
      }
      
      // 2. Process Remote Video -> recordingCanvasRef (for HR analysis/recording)
      const recordingCanvas = canvasRef.current;
      const isRemoteActive = role === 'hr' && remoteStream;
      if (recordingCanvas && (isAnalyzing || isRecording || isTranscriptionEnabled)) {
        const remoteVideo = remoteVideoRef.current;
        const ctx = recordingCanvas.getContext('2d');
        const { width, height } = recordingCanvas;
        
        if (isRemoteActive && remoteVideo && remoteVideo.readyState >= 2 && remoteVideo.videoWidth > 0) {
           ctx.drawImage(remoteVideo, 0, 0, width, height);
        } else {
           ctx.clearRect(0, 0, width, height);
        }

        // Draw Overlays...
        if (isAnalyzing && results.length > 0) {
          const emotion = results[0].emotion;
          ctx.fillStyle = 'rgba(26, 115, 232, 0.85)';
          ctx.font = 'bold 24px Google Sans, Roboto, Arial';
          const textWidth = ctx.measureText(emotion).width;
          ctx.roundRect ? ctx.roundRect(width - textWidth - 50, 20, textWidth + 30, 40, 8) : ctx.fillRect(width - textWidth - 50, 20, textWidth + 30, 40);
          ctx.fill();
          ctx.fillStyle = 'white';
          ctx.fillText(emotion, width - textWidth - 35, 48);
        }

        // 2. Draw REC Indicator
        if (isRecording) {
          const time = new Date().getMilliseconds();
          const opacity = time < 500 ? 1 : 0.4;
          ctx.fillStyle = `rgba(234, 67, 53, ${opacity})`;
          ctx.beginPath();
          ctx.arc(30, 35, 8, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'white';
          ctx.font = 'bold 18px Roboto, Arial';
          ctx.fillText('REC', 45, 42);
        }

        // 3. Draw Subtitles
        if (isTranscriptionEnabled && currentTranscript) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.font = '22px Roboto, Arial';
          const lines = currentTranscript.match(/.{1,60}(\s|$)/g) || [currentTranscript];
          const boxHeight = lines.length * 30 + 20;
          ctx.fillRect(width * 0.1, height - boxHeight - 40, width * 0.8, boxHeight);
          ctx.fillStyle = 'white';
          ctx.textAlign = 'center';
          lines.forEach((line, i) => {
            ctx.fillText(line.trim(), width / 2, height - boxHeight - 10 + (i * 30));
          });
          ctx.textAlign = 'start'; // Reset
        }
      }
      
      requestRef = requestAnimationFrame(animate);
    };
    if (hasJoined || (selectedDevice && isCamEnabled) || (role === 'hr' && remoteStream)) {
      requestRef = requestAnimationFrame(animate);
    }
    return () => cancelAnimationFrame(requestRef);
  }, [selectedDevice, isCamEnabled, processFrame, results, isAnalyzing, isRecording, isTranscriptionEnabled, currentTranscript, currentSpeaker, role, remoteStream]);

  // Synchronization with camera
  useEffect(() => {
    if (!isCamEnabled) {
      setIsAnalyzing(false);
    }
  }, [isCamEnabled]);

  // Update Speaker Output
  useEffect(() => {
    if (selectedSpeaker && remoteVideoRef.current && remoteVideoRef.current.setSinkId) {
      remoteVideoRef.current.setSinkId(selectedSpeaker)
        .then(() => console.log(`[Audio] Output device set to: ${selectedSpeaker}`))
        .catch(err => console.error("[Audio] Failed to set output device:", err));
    }
  }, [selectedSpeaker]);
  // WebRTC Signaling & Initialization
  useEffect(() => {
    if (!hasJoined) return;
    
    console.log(`[WebRTC] Initializing for room: ${roomID} as ${role}`);
    const cleanup = () => {
      if (socketRef.current) {
        console.log("[WebRTC] Closing socket");
        socketRef.current.close();
      }
      if (pcRef.current) {
        console.log("[WebRTC] Closing PeerConnection");
        pcRef.current.close();
      }
    };

    const initWebRTC = async () => {
      socketRef.current = new WebSocket(`ws://localhost:8000/ws/${roomID}/${role}_${Math.random().toString(36).substr(2, 5)}`);
      
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.send(JSON.stringify({ type: 'ice-candidate', candidate: event.candidate }));
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0]);
      };

      // Add local tracks (Video from Canvas, Audio from raw stream)
      let streamToSend = localStream;
      if (localStream && localCanvasRef.current) {
        try {
          // Fallback to 30 FPS stream from the canvas
          const canvasStream = localCanvasRef.current.captureStream(30);
          if (canvasStream && canvasStream.getVideoTracks().length > 0) {
            const audioTracks = localStream.getAudioTracks();
            streamToSend = new MediaStream([canvasStream.getVideoTracks()[0], ...audioTracks]);
            console.log("[WebRTC] Using Canvas stream for video (Privacy Mode compatibility)");
          }
        } catch (err) {
          console.error("[WebRTC] Failed to capture canvas stream:", err);
        }
      }

      if (streamToSend) {
        streamToSend.getTracks().forEach(track => {
          pc.addTrack(track, streamToSend);
        });
        console.log("[WebRTC] Local tracks added to PeerConnection");
      } else {
        console.warn("[WebRTC] No local stream found to add to PeerConnection");
      }

      socketRef.current.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        console.log(`[Signaling] Message: ${data.type}, Current State: ${pc.signalingState}`);

        try {
          if (data.type === 'offer') {
            if (pc.signalingState !== 'stable') {
                console.warn("[Signaling] Received offer in non-stable state, ignoring.");
                return;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            // Apply any pending candidates
            while (pendingCandidates.current.length > 0) {
              const cand = pendingCandidates.current.shift();
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socketRef.current.send(JSON.stringify({ type: 'answer', answer }));
          } else if (data.type === 'answer') {
            if (pc.signalingState !== 'have-local-offer') {
                console.warn("[Signaling] Received answer but no local offer sent, ignoring.");
                return;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            // Apply any pending candidates
            while (pendingCandidates.current.length > 0) {
              const cand = pendingCandidates.current.shift();
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            }
          } else if (data.type === 'ice-candidate') {
            if (data.candidate) {
              if (pc.remoteDescription) {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } else {
                pendingCandidates.current.push(data.candidate);
              }
            }
          } else if (data.type === 'join') {
            // If anyone joins and we are HR, we initiate an offer
            if (role === 'hr') {
              console.log("[Signaling] Another peer joined, preparing offer...");
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socketRef.current.send(JSON.stringify({ type: 'offer', offer }));
            }
          }
        } catch (err) {
          console.error("[Signaling] Error processing message:", err);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE Connection State: ${pc.iceConnectionState}`);
      };

      socketRef.current.onopen = async () => {
        console.log("Connected to signaling server in room:", roomID);
        // Both roles notify their presence
        socketRef.current.send(JSON.stringify({ type: 'join' }));
        
        // Optimistic: if we are HR, try an offer immediately in case someone is already there
        if (role === 'hr') {
          console.log("[Signaling] HR joined, trying optimistic offer...");
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.send(JSON.stringify({ type: 'offer', offer }));
          } catch (e) {
            console.warn("[Signaling] Optimistic offer failed (likely no tracks yet):", e);
          }
        }
      };

      pcRef.current = pc;
    };

    initWebRTC();
    return cleanup;
  }, [hasJoined, roomID, role, selectedDevice]); 
  
  // Assign remote stream to video element whenever it changes
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      console.log("[WebRTC] Assigning remote stream to video element.");
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

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
    // HR analyzes the remote video, Candidate analyzes their own local webcam
    const videoSource = role === 'hr' ? remoteVideoRef.current : webcamRef.current?.video;
    const isSourceActive = role === 'hr' ? !!remoteStream : isCamEnabled;
    
    if (canvasRef.current && isSourceActive && videoSource) {
      // If we are HR and have a remote video, we draw it to the canvas for analysis/recording
      if (role === 'hr' && remoteVideoRef.current) {
         const ctx = canvasRef.current.getContext('2d');
         ctx.drawImage(remoteVideoRef.current, 0, 0, 1280, 720);
      }
      
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
    stopScreenShare();
    setSelectedDevice(null);
    setHasJoined(false);
    setIsAnalyzing(false);
    setResults([]);
    setMessages([]);
    setNotes('');
    setIsChatOpen(false);
    setIsParticipantsOpen(false);
    setIsNotesOpen(false);
    setIsToolsOpen(false);
    setIsRecording(false);
    setIsTranscriptionEnabled(false);
    setTranscriptHistory([]);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const sendMessage = () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    setMessages(prev => [
      ...prev,
      { id: Date.now(), text: trimmed, sender: role === 'hr' ? 'Vous (Recruteur)' : 'Vous (Candidat)', time: new Date() }
    ]);
    setChatInput('');
  };

  // Auto-scroll to latest message
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = null;
    }
    setIsScreenSharing(false);
  };

  const startRecording = async () => {
    try {
      let stream;
      
      if (isScreenSharing && screenStreamRef.current) {
        stream = screenStreamRef.current.clone(); // Clone to avoid side effects on the display stream
      } else if (canvasRef.current) {
        stream = canvasRef.current.captureStream(30);
      } else {
        throw new Error("Aucune source vidéo active. Activez votre caméra ou le partage d'écran.");
      }
      
      // Clear previous chunks
      recordedChunksRef.current = [];
      
      // Try to add audio
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStream.getAudioTracks().forEach(track => stream.addTrack(track));
      } catch (audioErr) {
        console.warn("Démarrage sans audio:", audioErr);
      }

      initRecorder(stream);
    } catch (err) {
      console.error("Erreur startRecording:", err);
      alert("Impossible de démarrer l'enregistrement: " + err.message);
      setIsRecording(false);
    }
  };

  const initRecorder = (stream) => {
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
      'video/mp4'
    ];
    
    let type = mimeTypes.find(t => MediaRecorder.isTypeSupported(t));
    
    try {
      const recorder = type 
        ? new MediaRecorder(stream, { mimeType: type })
        : new MediaRecorder(stream);
        
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        if (recordedChunksRef.current.length === 0) {
          alert("Erreur: Aucune donnée capturée. L'enregistrement est vide.");
          return;
        }
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HumatiQ_Session_${new Date().getTime()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        alert("Erreur pendant l'enregistrement.");
        setIsRecording(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (err) {
      console.error("MediaRecorder creation failed:", err);
      alert("Erreur d'initialisation de l'enregistreur.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      // Small optimistic update for feedback
      startRecording();
    }
  };

  const toggleTranscription = () => {
    if (isTranscriptionEnabled) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsTranscriptionEnabled(false);
      setCurrentTranscript("");
    } else {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("La transcription n'est pas supportée sur ce navigateur.");
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'fr-FR'; // Default to French
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            const final = event.results[i][0].transcript.trim();
            if (final) {
              setTranscriptHistory(prev => [...prev, {
                sender: currentSpeaker,
                text: final,
                time: new Date()
              }]);
            }
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        setCurrentTranscript(interimTranscript || event.results[event.results.length - 1][0].transcript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === 'not-allowed') {
          alert("Accès micro refusé pour la transcription.");
        }
        setIsTranscriptionEnabled(false);
      };

      recognition.onend = () => {
        // Auto-restart if it was still supposed to be enabled
        if (isTranscriptionEnabled) {
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsTranscriptionEnabled(true);
    }
  };

  const downloadTranscript = () => {
    if (transcriptHistory.length === 0) {
      alert("Aucun texte à télécharger pour le moment.");
      return;
    }
    const content = transcriptHistory.map(entry => 
      `[${entry.time.toLocaleTimeString()}] ${entry.sender}: ${entry.text}`
    ).join('\n');
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Transcript_HumatiQ_${new Date().getTime()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenShare();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      screenStreamRef.current = stream;
      // Auto-stop when user clicks "Stop sharing" in browser bar
      stream.getVideoTracks()[0].onended = () => stopScreenShare();
      setIsScreenSharing(true); // triggers re-render → <video> mounts → useEffect assigns srcObject
    } catch (err) {
      console.log('Screen share cancelled or denied:', err);
    }
  };

  // Assign srcObject after the <video> element is mounted (isScreenSharing = true triggers render)
  useEffect(() => {
    if (isScreenSharing && screenVideoRef.current && screenStreamRef.current) {
      screenVideoRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing]);

  const formatTime = (date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (!hasJoined) {
    const selectedMicLabel = mics.find(d => d.deviceId === selectedMic)?.label || "Microphone";
    const selectedCamLabel = devices.find(d => d.deviceId === selectedDevice)?.label || "Camera";
    const selectedSpeakerLabel = speakers.find(d => d.deviceId === selectedSpeaker)?.label || "Speaker";

    return (
      <div className="selection-view">
        {/* Header Section */}
        <header className="prejoin-header">
          <div className="brand-title">HumatiQ</div>
          <nav className="header-nav">
            <span className="nav-link active">Meeting</span>
            <span className="nav-link">Devices</span>
            <span className="nav-link">Network</span>
          </nav>
          <div className="header-actions">
            <div className="icon-btn"><Settings size={20} /></div>
            <div className="icon-btn"><HelpCircle size={20} /></div>
            <div className="profile-avatar">
              <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=HR`} alt="Profile" />
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="prejoin-main">
          {/* Left: Video Preview & Device Footer */}
          <div className="prejoin-left">
            <div className="preview-wrapper">
              {isCamEnabled && selectedDevice ? (
                 <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                   <Webcam
                     audio={false}
                     onUserMedia={(stream) => { setLocalStream(stream); refreshDevices(); }}
                     videoConstraints={{ deviceId: { exact: selectedDevice } }}
                     style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                     mirrored={true}
                     ref={webcamRef}
                   />
                   <canvas 
                     ref={localCanvasRef} 
                     width={1280} 
                     height={720} 
                     className={role !== 'hr' ? 'mirrored-video' : ''} 
                     style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                   />
                 </div>
              ) : (
                 <div className="camera-disabled-placeholder">
                    <VideoOff size={64} color="#5f6368" />
                    <div style={{ color: '#ffffff', textAlign: 'center', fontSize: '14px', fontWeight: '500', opacity: 0.7, marginTop: '16px' }}>
                      {isCamEnabled ? "Chargement de la caméra..." : "La caméra est désactivée"}
                    </div>
                 </div>
              )}

              {/* Pill-style Overlay Controls */}
              <div className="preview-controls-overlay">
                <button 
                  className={`preview-tool-btn ${!isMicEnabled ? 'off' : ''}`}
                  onClick={() => setIsMicEnabled(!isMicEnabled)}
                >
                  {isMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                </button>
                <button 
                  className={`preview-tool-btn ${!isCamEnabled ? 'off' : ''}`}
                  onClick={() => setIsCamEnabled(!isCamEnabled)}
                >
                  {isCamEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>
                <button 
                  className={`preview-tool-btn ${isBlurEnabled ? 'active' : ''}`}
                  onClick={() => setIsBlurEnabled(!isBlurEnabled)}
                  title="Effets visuels"
                >
                  <Sparkles size={20} />
                </button>
                <div className="preview-divider"></div>
                <button className="preview-tool-btn">
                  <MoreVertical size={20} />
                </button>
              </div>
            </div>

            {/* Structured Device Selection Footer */}
            <div className="prejoin-footer-devices">
              <div className="device-box">
                <div className="device-label">Microphone</div>
                <div className="dropdown-container">
                  <button className="device-selector-pill" onClick={() => setActiveDropdown(activeDropdown === 'mic' ? null : 'mic')}>
                    <div className="pill-content">
                      <Mic size={16} />
                      <span>{selectedMicLabel}</span>
                    </div>
                    <ChevronDown size={14} />
                  </button>
                  {activeDropdown === 'mic' && (
                    <div className="device-dropdown">
                      {mics.map(m => (
                        <div 
                          key={m.deviceId} 
                          className={`dropdown-item ${selectedMic === m.deviceId ? 'active' : ''}`}
                          onClick={() => { setSelectedMic(m.deviceId); setActiveDropdown(null); }}
                        >
                          {m.label || `Microphone ${m.deviceId.slice(0, 5)}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="device-box">
                <div className="device-label">Audio Output</div>
                <div className="dropdown-container">
                  <button className="device-selector-pill" onClick={() => setActiveDropdown(activeDropdown === 'speaker' ? null : 'speaker')}>
                    <div className="pill-content">
                      <Volume2 size={16} />
                      <span>{selectedSpeakerLabel}</span>
                    </div>
                    <ChevronDown size={14} />
                  </button>
                  {activeDropdown === 'speaker' && (
                    <div className="device-dropdown">
                      {speakers.map(s => (
                        <div 
                          key={s.deviceId} 
                          className={`dropdown-item ${selectedSpeaker === s.deviceId ? 'active' : ''}`}
                          onClick={() => { setSelectedSpeaker(s.deviceId); setActiveDropdown(null); }}
                        >
                          {s.label || `Sortie ${s.deviceId.slice(0, 5)}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="device-box">
                <div className="device-label">Camera</div>
                <div className="dropdown-container">
                  <button className="device-selector-pill" onClick={() => setActiveDropdown(activeDropdown === 'cam' ? null : 'cam')}>
                    <div className="pill-content">
                      <Video size={16} />
                      <span>{selectedCamLabel}</span>
                    </div>
                    <ChevronDown size={14} />
                  </button>
                  {activeDropdown === 'cam' && (
                    <div className="device-dropdown">
                      {devices.map(c => (
                        <div 
                          key={c.deviceId} 
                          className={`dropdown-item ${selectedDevice === c.deviceId ? 'active' : ''}`}
                          onClick={() => { setSelectedDevice(c.deviceId); setActiveDropdown(null); }}
                        >
                          {c.label || `Caméra ${c.deviceId.slice(0, 5)}`}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Hero Text & Join Actions */}
          <div className="prejoin-right">
            <h1 className="join-hero-title">Prêt à participer ?</h1>
            <p className="join-hero-subtitle">Personne d'autre ne participe à cet appel</p>
            
            <button 
              className="btn-participate"
              onClick={() => {
                setHasJoined(true);
                setSessionId("FACE-" + Math.random().toString(36).substr(2, 9).toUpperCase());
                setIsAnalyzing(true);
              }}
            >
              Participer à la réunion
            </button>

            {/* Meeting Status Row */}
            <div className="meeting-status-row">
              <div className="status-avatars">
                <div className="status-avatar"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" alt="user" /></div>
                <div className="status-avatar"><img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Aria" alt="user" /></div>
                <div className="status-avatar more">+12</div>
              </div>
              <div className="status-text">Session active par HR-Admin</div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="meeting-container">
      {/* Main Area: video + optional chat sidebar */}
      <div className="meeting-body">
        {/* Room Content (Interview Layout) */}
        <main className="room-content">
          <div className="interview-layout">
          {/* Main View: Screen Share OR Candidate Webcam */}
          <div className="candidate-view">
            {isScreenSharing ? (
              <>
                <video
                  ref={screenVideoRef}
                  autoPlay
                  playsInline
                  style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '12px', background: '#000' }}
                />
                <div className="candidate-name" style={{ background: 'rgba(26,115,232,0.85)' }}>
                  <MonitorUp size={14} style={{ marginRight: '6px' }} />
                  <span>You are sharing your screen</span>
                </div>
              </>
            ) : (
              /* Camera View Area */
              <div className="video-wrapper" style={{ width: '100%', height: '100%' }}>
                {isCamEnabled && (
                  <Webcam
                    key={selectedDevice}
                    audio={false}
                    ref={webcamRef}
                    onUserMedia={(stream) => {
                      setLocalStream(stream);
                      console.log("[Webcam] Media stream ready");
                      setIsStreamReady(true);
                    }}
                    onUserMediaError={(err) => {
                      console.error("[Webcam] Error:", err);
                    }}
                    screenshotFormat="image/jpeg"
                    videoConstraints={{ deviceId: selectedDevice ? { exact: selectedDevice } : undefined, width: 1280, height: 720 }}
                    style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                  />
                )}
                
                {remoteStream ? (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="webcam-feed"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  /* While alone, both see a waiting message, but can see themselves in PIP */
                  <div className="waiting-placeholder-container">
                    <div className="waiting-avatar-pulse">
                      <Users size={48} />
                    </div>
                    <div className="waiting-text-title">
                      {role === 'hr' ? 'En attente du candidat...' : "En attente de l'hôte..."}
                    </div>
                    <div className="waiting-text-subtitle">
                      {role === 'hr' 
                        ? "La session commencera dès que le candidat rejoindra l'appel."
                        : "L'entretien commencera dès que le recruteur sera prêt."}
                    </div>
                    {!isCamEnabled && (
                      <div style={{ marginTop: '20px', color: '#ea4335', fontSize: '14px', fontWeight: '500' }}>
                        <VideoOff size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
                        Votre caméra est désactivée
                      </div>
                    )}
                  </div>
                )}
                
                <div className="candidate-name">
                  <span>{remoteStream ? (role === 'hr' ? 'Candidat' : 'Recruteur') : (role === 'hr' ? 'Candidat (En attente...)' : 'Vous')}</span>
                </div>

                {/* Recruiter Only Overlays */}
                {role === 'hr' && results.length > 0 && isAnalyzing && (
                  <div className="emotion-badge">
                    {results[0].emotion}
                  </div>
                )}
                {role === 'hr' && isRecording && (
                  <div style={{
                    position: 'absolute',
                    top: '12px',
                    left: '12px',
                    background: 'rgba(234, 67, 53, 0.85)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    zIndex: 20
                  }}>
                    <div style={{ width: '8px', height: '8px', background: 'white', borderRadius: '50%', animation: 'pulse 1s infinite' }}></div>
                    REC
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Subtitles Overlay (Recruiter Only) */}
          {role === 'hr' && isTranscriptionEnabled && currentTranscript && (
            <div className="subtitles-overlay">
              <div className="subtitle-text">
                <span style={{ color: currentSpeaker === 'Candidat' ? '#8ab4f8' : '#34a853', fontWeight: 'bold' }}>
                  {currentSpeaker}:{" "}
                </span>
                {currentTranscript}
              </div>
            </div>
          )}

          <div className="recruiter-pip">
            {isCamEnabled ? (
              /* Always show the processed local canvas in PIP for all roles */
              <canvas 
                ref={localCanvasRef} 
                width={1280} 
                height={720} 
                className={`webcam-feed ${role !== 'hr' ? 'mirrored-video' : ''}`}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <div className="peer-avatar" style={{ fontSize: '1rem', width: '40px', height: '40px' }}>
                {role === 'hr' ? 'R' : 'C'}
              </div>
            )}
            <div className="pip-label">
              {isMicEnabled ? <Mic size={10} /> : <MicOff size={10} color="#ea4335" />}
              <span style={{ marginLeft: '4px' }}>Vous</span>
            </div>
          </div>
          </div>
        </main>

        {/* Participants Panel */}
        <aside className={`chat-panel ${isParticipantsOpen ? 'open' : ''}`}>
          <div className="chat-header">
            <span>Participants ({participants.length})</span>
            <button className="chat-close-btn" onClick={() => setIsParticipantsOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="participants-list">
            {participants.map(p => (
              <div key={p.id} className="participant-row">
                <div className="participant-avatar">{p.avatar}</div>
                <div className="participant-info">
                  <span className="participant-name">{p.name}</span>
                  <span className="participant-role">{p.role}</span>
                </div>
                <div className="participant-status">
                  {p.mic
                    ? <Mic size={14} color="#bdc1c6" />
                    : <MicOff size={14} color="#ea4335" />}
                  {p.cam
                    ? <Video size={14} color="#bdc1c6" />
                    : <VideoOff size={14} color="#ea4335" />}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat Panel */}
        <aside className={`chat-panel ${isChatOpen ? 'open' : ''}`}>
          <div className="chat-header">
            <span>Messages</span>
            <button className="chat-close-btn" onClick={() => setIsChatOpen(false)}>
              <X size={18} />
            </button>
          </div>

          <div className="chat-messages">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`chat-message ${msg.sender.startsWith('Vous (') ? 'mine' : 'theirs'}`}
              >
                <span className="msg-sender">{msg.sender}</span>
                <div className="msg-bubble">{msg.text}</div>
                <span className="msg-time">
                  {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          <div className="chat-input-area">
            <input
              className="chat-input"
              type="text"
              placeholder="Envoyer un message..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
            />
            <button className="chat-send-btn" onClick={sendMessage}>
              <Send size={18} />
            </button>
          </div>
        </aside>

        {/* Tools Panel */}
        <aside className={`chat-panel ${isToolsOpen ? 'open' : ''}`}>
          <div className="chat-header">
            <LayoutGrid size={18} style={{ marginRight: '8px' }} />
            <span>Outils de session</span>
            <button className="chat-close-btn" onClick={() => setIsToolsOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="tools-list" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div 
              className={`tool-card ${isRecording ? 'active' : ''}`}
              onClick={toggleRecording}
              style={{
                background: isRecording ? 'rgba(234, 67, 53, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isRecording ? '#ea4335' : 'rgba(255, 255, 255, 0.1)'}`,
                padding: '16px',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ padding: '8px', background: isRecording ? '#ea4335' : '#3c4043', borderRadius: '50%', display: 'flex' }}>
                <Circle size={18} color="white" fill={isRecording ? 'white' : 'transparent'} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>{isRecording ? 'Enregistrement...' : 'Enregistrer la session'}</div>
                <div style={{ fontSize: '0.75rem', color: '#bdc1c6' }}>Audio et vidéo de l'entretien</div>
              </div>
            </div>

            <div 
              className="tool-card"
              onClick={toggleTranscription}
              style={{
                background: isTranscriptionEnabled ? 'rgba(138, 180, 248, 0.1)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${isTranscriptionEnabled ? '#8ab4f8' : 'rgba(255, 255, 255, 0.1)'}`,
                padding: '16px',
                borderRadius: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ padding: '8px', background: isTranscriptionEnabled ? '#8ab4f8' : '#3c4043', borderRadius: '50%', display: 'flex' }}>
                <MessageSquareText size={18} color={isTranscriptionEnabled ? '#202124' : 'white'} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>Transcription IA</div>
                <div style={{ fontSize: '0.75rem', color: '#bdc1c6' }}>Sous-titres en temps réel</div>
              </div>
              <div style={{ 
                width: '36px', 
                height: '20px', 
                background: isTranscriptionEnabled ? '#8ab4f8' : '#3c4043', 
                borderRadius: '10px', 
                position: 'relative',
                transition: 'all 0.2s'
              }}>
                <div style={{ 
                  position: 'absolute', 
                  top: '2px', 
                  left: isTranscriptionEnabled ? '18px' : '2px', 
                  width: '16px', 
                  height: '16px', 
                  background: 'white', 
                  borderRadius: '50%',
                  transition: 'all 0.2s shadow'
                }} />
              </div>
            </div>

            {isTranscriptionEnabled && (
              <div className="transcription-controls" style={{ marginTop: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ fontSize: '0.8rem', color: '#8ab4f8', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Mic size={12} />
                  <span>Source: Micro {role === 'hr' ? 'Recruteur' : 'Candidat'} (Auto)</span>
                </div>
                
                <button 
                  onClick={downloadTranscript}
                  style={{ 
                    width: '100%', 
                    marginTop: '8px', 
                    padding: '8px', 
                    borderRadius: '6px', 
                    border: '1px solid #8ab4f8', 
                    background: 'transparent',
                    color: '#8ab4f8',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <SquareTerminal size={14} />
                  Télécharger le Transcript
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Notes Panel — Recruiter Only */}
        {role === 'hr' && <aside className={`chat-panel ${isNotesOpen ? 'open' : ''}`}>
          <div className="chat-header">
            <NotebookPen size={18} style={{ marginRight: '8px' }} />
            <span>Notes de session</span>
            <button className="chat-close-btn" onClick={() => setIsNotesOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="notes-container" style={{ flex: 1, padding: '16px', display: 'flex' }}>
            <textarea
              className="notes-textarea"
              placeholder="Prenez vos notes ici..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
                border: 'none',
                color: '#e8eaed',
                fontSize: '0.95rem',
                lineHeight: '1.6',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
          </div>
        </aside>}
      </div>

      {/* Control Bar */}
      <footer className="control-bar">
        <div className="meeting-details">
          <span className="time-str">{formatTime(currentTime)}</span>
          <span style={{ color: '#bdc1c6', fontSize: '0.9rem' }}>Meeting Room | HumatiQ</span>
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

          {role === 'hr' && (
            <button 
              className={`round-btn ${isAnalyzing ? 'active' : ''}`}
              onClick={toggleAnalysis}
              title={isAnalyzing ? "Stop Analysis" : "Start Emotion Analysis"}
            >
              <BrainCircuit size={20} />
            </button>
          )}

          <button 
            className={`round-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
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
          {role === 'hr' && (
            <button
              className={`round-btn ${isToolsOpen ? 'active' : ''}`}
              style={isToolsOpen ? {} : { background: 'transparent', border: 'none' }}
              onClick={() => { setIsToolsOpen(p => !p); setIsChatOpen(false); setIsParticipantsOpen(false); setIsNotesOpen(false); }}
              title="Outils"
            >
              <LayoutGrid size={20} />
            </button>
          )}
          <button
            className={`round-btn ${isParticipantsOpen ? 'active' : ''}`}
            style={isParticipantsOpen ? {} : { background: 'transparent', border: 'none' }}
            onClick={() => { setIsParticipantsOpen(p => !p); setIsChatOpen(false); setIsNotesOpen(false); setIsToolsOpen(false); }}
            title="Participants"
          >
            <Users size={20} />
            <span className="chat-badge" style={{ background: '#34a853' }}>{participants.length}</span>
          </button>
          <button
            className={`round-btn ${isChatOpen ? 'active' : ''}`}
            style={isChatOpen ? {} : { background: 'transparent', border: 'none' }}
            onClick={() => { setIsChatOpen(prev => !prev); setIsParticipantsOpen(false); setIsNotesOpen(false); setIsToolsOpen(false); }}
            title="Messages"
          >
            <MessageSquare size={20} />
            {messages.length > 0 && !isChatOpen && (
              <span className="chat-badge">{messages.length}</span>
            )}
          </button>
          {role === 'hr' && (
          <button
            className={`round-btn ${isNotesOpen ? 'active' : ''}`}
            style={isNotesOpen ? {} : { background: 'transparent', border: 'none' }}
            onClick={() => { setIsNotesOpen(prev => !prev); setIsChatOpen(false); setIsParticipantsOpen(false); setIsToolsOpen(false); }}
            title="Notes"
          >
            <NotebookPen size={20} />
          </button>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;
