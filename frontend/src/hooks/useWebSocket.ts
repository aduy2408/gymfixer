import { useState, useEffect, useCallback, useRef } from 'react';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface PoseMessage {
  type: 'frame';
  exercise: string;
  image: string; // base64 encoded frame
}

// Normalized response used by the app UI
export interface PoseResponse {
  status: 'ok' | 'no_pose' | 'incorrect' | 'unknown';
  feedback: string; // human readable message
  confidence?: number;
}

export interface RawServerMessage {
  // backend may send different shapes; we normalize here
  feedback?: string[] | string;
  skeleton_frame?: string; // base64
  skeleton_binary?: boolean;
  throttled?: boolean;
}

interface UseWebSocketReturn {
  status: ConnectionStatus;
  feedback: PoseResponse | null;
  connect: () => void;
  disconnect: () => void;
  sendFrame: (data: string | ArrayBuffer, exercise: string) => boolean;
  sendMeta: (meta: Record<string, any>) => void;
  lastSkeletonUrl: string | null; // object URL for latest binary skeleton
  error: string | null;
}

function resolveWebSocketUrl(): string {
  // 1. Explicit override via env var (highest priority)
  //    Set VITE_WS_URL=wss://your-backend.com/ws/posture in .env.local
  const envUrl = (import.meta as any).env?.VITE_WS_URL;
  if (envUrl) return envUrl;

  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const hostname = window.location.hostname;

  // 2. Local dev: backend runs on a separate port (5000 by default, or VITE_API_PORT)
  //    → ws://localhost:5000/ws/posture
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (isLocalhost) {
    const backendPort = (import.meta as any).env?.VITE_API_PORT || '5000';
    return `${protocol}://${hostname}:${backendPort}/ws/posture`;
  }

  // 3. Public host (ngrok, VPS, etc.): use same origin so the request goes through
  //    whatever reverse-proxy/nginx is in front — no port needed.
  //    → wss://abc.ngrok-free.app/ws/posture
  return `${protocol}://${window.location.host}/ws/posture`;
}

export function useWebSocket(): UseWebSocketReturn {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [feedback, setFeedback] = useState<PoseResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSkeletonUrl, setLastSkeletonUrl] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const waitingForFrameResponseRef = useRef(false);
  const frameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (frameTimeoutRef.current) {
      clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }
    waitingForFrameResponseRef.current = false;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    cleanup();
    setStatus('connecting');
    setError(null);

    try {
      const ws = new WebSocket(resolveWebSocketUrl());
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        setError(null);
        console.info('[useWebSocket] connected to', resolveWebSocketUrl());
      };

      ws.onclose = (ev) => {
        console.warn('[useWebSocket] closed', ev.reason || ev.code);
        setStatus('disconnected');
        wsRef.current = null;
        // attempt a retry after a delay
        if (ev.code !== 1000) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.info('[useWebSocket] attempting reconnect...');
            connect();
          }, 1500);
        }
      };

      ws.onerror = (ev) => {
        console.error('[useWebSocket] error', ev);
        setStatus('error');
        setError('Failed to connect to posture detection server. Ensure backend is running.');
        wsRef.current = null;
      };
      ws.onmessage = async (event) => {
        try {
          // Binary skeleton image (server sends bytes after sending a JSON that has skeleton_binary)
          if (event.data instanceof Blob) {
            const blob = event.data as Blob;
            waitingForFrameResponseRef.current = false;
            if (frameTimeoutRef.current) {
              clearTimeout(frameTimeoutRef.current);
              frameTimeoutRef.current = null;
            }
            // free previous URL
            if (lastSkeletonUrl) {
              URL.revokeObjectURL(lastSkeletonUrl);
            }
            const url = URL.createObjectURL(blob);
            setLastSkeletonUrl(url);
            return;
          }

          // Text message
          const text = await (event.data as string);
          const parsed: RawServerMessage = JSON.parse(text);
          if (parsed.feedback || parsed.skeleton_frame || parsed.skeleton_binary) {
            waitingForFrameResponseRef.current = false;
            if (frameTimeoutRef.current) {
              clearTimeout(frameTimeoutRef.current);
              frameTimeoutRef.current = null;
            }
          }
          // Normalize feedback array/string into PoseResponse expected by UI
          const fbArr: string[] = [];
          if (Array.isArray(parsed.feedback)) {
            fbArr.push(...parsed.feedback);
          } else if (typeof parsed.feedback === 'string') {
            fbArr.push(parsed.feedback);
          }

          // Determine status heuristically from messages
          let statusGuess: PoseResponse['status'] = 'unknown';
          if (fbArr.length === 0) {
            statusGuess = 'no_pose';
          } else {
            const joined = fbArr.join(' ').toLowerCase();
            if (joined.includes('please get fully into the frame') || joined.includes('no person')) {
              statusGuess = 'no_pose';
            } else if (joined.includes('excellent') || joined.includes('good') || joined.includes('nice') || joined.includes('great')) {
              statusGuess = 'ok';
            } else if (joined.includes('not supported')) {
              statusGuess = 'unknown';
            } else {
              statusGuess = 'incorrect';
            }
          }

          setFeedback({
            status: statusGuess,
            feedback: fbArr.join(' | '),
          });

          // If server sent base64 skeleton frame, set it as an object URL
          if (parsed.skeleton_frame) {
            // convert base64 to blob
            const res = atob(parsed.skeleton_frame);
            const buf = new Uint8Array(res.length);
            for (let i = 0; i < res.length; i++) buf[i] = res.charCodeAt(i);
            const blob = new Blob([buf], { type: 'image/jpeg' });
            if (lastSkeletonUrl) URL.revokeObjectURL(lastSkeletonUrl);
            const url = URL.createObjectURL(blob);
            setLastSkeletonUrl(url);
          }

        } catch (err) {
          console.error('[useWebSocket] Failed to handle message', err);
        }
      };
    } catch {
      setStatus('error');
      setError('Failed to create WebSocket connection');
    }
  }, [cleanup]);

  const disconnect = useCallback(() => {
    cleanup();
    setStatus('disconnected');
    setFeedback(null);
  }, [cleanup]);

  const sendFrame = useCallback((data: string | ArrayBuffer, exercise: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN && !waitingForFrameResponseRef.current) {
      waitingForFrameResponseRef.current = true;
      if (frameTimeoutRef.current) clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = setTimeout(() => {
        waitingForFrameResponseRef.current = false;
        frameTimeoutRef.current = null;
      }, 1000);

      if (typeof data === 'string') {
        // base64 string
        const payload = {
          exercise,
          frame: data,
        } as const;
        wsRef.current.send(JSON.stringify(payload));
      } else {
        // binary ArrayBuffer - send directly
        try {
          // send a small JSON meta first so server knows exercise
          const meta = { type: 'meta', exercise };
          wsRef.current.send(JSON.stringify(meta));
          wsRef.current.send(data);
        } catch (e) {
          waitingForFrameResponseRef.current = false;
          console.error('[useWebSocket] send binary error', e);
        }
      }
      return true;
    }
    return false;
  }, []);

  const sendMeta = useCallback((meta: Record<string, any>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try { wsRef.current.send(JSON.stringify(meta)); } catch (e) { console.error('[useWebSocket] sendMeta error', e); }
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  return {
    status,
    feedback,
    connect,
    disconnect,
    sendFrame,
    sendMeta,
    lastSkeletonUrl,
    error,
  };
}
