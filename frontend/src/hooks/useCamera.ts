import { useState, useEffect, useRef, useCallback } from 'react';

export type CameraFacingMode = 'user' | 'environment';

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isStreaming: boolean;
  error: string | null;
  facingMode: CameraFacingMode;
  startCamera: (nextFacingMode?: CameraFacingMode) => Promise<void>;
  stopCamera: () => void;
  switchCamera: () => Promise<void>;
  captureFrame: () => string | null;
}

export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<CameraFacingMode>('user');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const startCamera = useCallback(async (nextFacingMode: CameraFacingMode = facingMode) => {
    setError(null);
    
    try {
      // Check for camera support
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      stopCamera();

      // Request camera access. Use ideal facingMode so browsers without a
      // matching camera can gracefully fall back instead of hard failing.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: { ideal: nextFacingMode },
        },
        audio: false,
      });

      streamRef.current = stream;
      setFacingMode(nextFacingMode);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsStreaming(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access camera';
      
      if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
        setError('Camera permission denied. Please allow camera access to use posture detection.');
      } else if (errorMessage.includes('NotFoundError')) {
        setError('No camera found. Please connect a camera and try again.');
      } else {
        setError(errorMessage);
      }
      
      setIsStreaming(false);
    }
  }, [facingMode, stopCamera]);

  const switchCamera = useCallback(async () => {
    const nextFacingMode: CameraFacingMode = facingMode === 'user' ? 'environment' : 'user';
    await startCamera(nextFacingMode);
  }, [facingMode, startCamera]);

  const captureFrame = useCallback((): string | null => {
    if (!videoRef.current || !canvasRef.current || !isStreaming) {
      return null;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    // Send a smaller frame to the backend so analysis does not stall the live
    // camera preview on phones.
    const maxWidth = 480;
    const scale = Math.min(1, maxWidth / (video.videoWidth || maxWidth));
    canvas.width = Math.round((video.videoWidth || maxWidth) * scale);
    canvas.height = Math.round((video.videoHeight || 480) * scale);

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64 (remove data URL prefix for cleaner transmission)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
    return dataUrl.split(',')[1]; // Return only base64 portion
  }, [isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  return {
    videoRef,
    canvasRef,
    isStreaming,
    error,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera,
    captureFrame,
  };
}
