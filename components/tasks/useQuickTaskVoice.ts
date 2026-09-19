'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_QUICK_TASK_AUDIO_BYTES, MAX_QUICK_TASK_RECORDING_MS, validateQuickTaskAudio } from '@/lib/quick-task-audio';

export type VoiceState = 'idle' | 'requestingPermission' | 'recording' | 'transcribing' | 'error';

export function useQuickTaskVoice(isOpen: boolean, onTranscript: (text: string) => void) {
  const [state, setState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionRef = useRef(0);
  const busyRef = useRef(false);
  const transcriptRef = useRef(onTranscript);
  transcriptRef.current = onTranscript;

  const releaseStream = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    timerRef.current = null;
    stopTimerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    sessionRef.current += 1;
    requestRef.current?.abort();
    requestRef.current = null;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder) {
      recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
      if (recorder.state !== 'inactive') { try { recorder.stop(); } catch { /* Tracks still must be released. */ } }
    }
    releaseStream();
    busyRef.current = false;
  }, [releaseStream]);

  useEffect(() => {
    if (isOpen) { setState('idle'); setError(null); setSeconds(0); }
    return cancel;
  }, [isOpen, cancel]);

  function fail(message: string) {
    cancel();
    setState('error');
    setError(message);
  }

  function stop() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== 'recording') return;
    setState('transcribing');
    try {
      recorder.stop();
      releaseStream();
    } catch {
      fail('Nahrávání selhalo. Zkuste je zopakovat nebo úkol napište ručně.');
    }
  }

  async function start() {
    if (busyRef.current || !isOpen) return;
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      fail('Tento prohlížeč nepodporuje nahrávání hlasu. Otevřete SeePoint přes HTTPS v Safari nebo Chrome, případně úkol napište ručně.');
      return;
    }
    busyRef.current = true;
    const session = ++sessionRef.current;
    setState('requestingPermission');
    setError(null);
    setSeconds(0);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (session !== sessionRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      const chunks: Blob[] = [];
      let bytes = 0;
      let sent = false;
      recorder.ondataavailable = event => {
        if (session !== sessionRef.current || !event.data.size) return;
        chunks.push(event.data);
        bytes += event.data.size;
        if (bytes > MAX_QUICK_TASK_AUDIO_BYTES) fail('Nahrávka je příliš velká. Namluvte kratší zadání.');
      };
      recorder.onerror = () => fail('Nahrávání selhalo. Zkuste je zopakovat nebo úkol napište ručně.');
      recorder.onstop = async () => {
        if (sent || session !== sessionRef.current) return;
        sent = true;
        releaseStream();
        recorderRef.current = null;
        const audio = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || '' });
        const validationError = validateQuickTaskAudio(audio);
        if (validationError) { fail(validationError); return; }
        setState('transcribing');
        const controller = new AbortController();
        requestRef.current = controller;
        const timeout = setTimeout(() => controller.abort(), 30_000);
        try {
          const form = new FormData();
          form.append('audio', audio, 'quick-task-audio');
          const response = await fetch('/api/ai/transcribe-quick-task', { method: 'POST', body: form, signal: controller.signal });
          const data = await response.json().catch(() => ({}));
          if (session !== sessionRef.current) return;
          if (!response.ok) {
            const message = response.status === 504 ? 'Přepis trval příliš dlouho. Zkuste to znovu.'
              : response.status === 413 ? 'Nahrávka je příliš velká. Namluvte kratší zadání.'
              : response.status === 422 ? 'V nahrávce nebyla rozpoznána řeč. Zkuste ji zopakovat.'
              : response.status === 401 || response.status === 403 ? 'Přepis není povolen. Zkontrolujte přihlášení a aktivní organizaci.'
              : response.status === 502 ? 'AI přepis není dostupný. Zkuste to znovu nebo úkol napište ručně.'
              : 'Hlas se nepodařilo přepsat. Zkuste nahrávání zopakovat nebo úkol napište ručně.';
            fail(message);
            return;
          }
          if (typeof data.transcript !== 'string' || !data.transcript.trim()) { fail('V nahrávce nebyla rozpoznána řeč. Zkuste ji zopakovat.'); return; }
          transcriptRef.current(data.transcript.trim());
          setState('idle');
          busyRef.current = false;
        } catch {
          if (session === sessionRef.current) fail(controller.signal.aborted
            ? 'Přepis trval příliš dlouho. Zkuste to znovu nebo úkol napište ručně.'
            : 'Hlas se nepodařilo přepsat. Zkontrolujte připojení nebo úkol napište ručně.');
        } finally {
          clearTimeout(timeout);
          if (requestRef.current === controller) requestRef.current = null;
        }
      };
      recorder.start(1000);
      setState('recording');
      const started = Date.now();
      timerRef.current = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
      stopTimerRef.current = setTimeout(stop, MAX_QUICK_TASK_RECORDING_MS);
    } catch (cause) {
      if (session !== sessionRef.current) return;
      const name = cause instanceof Error ? cause.name : '';
      fail(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Mikrofon není povolen. Povolte aplikaci SeePoint přístup k mikrofonu v nastavení prohlížeče.'
        : name === 'NotFoundError' || name === 'NotReadableError' || name === 'AbortError'
          ? 'Mikrofon není dostupný. Zkontrolujte, zda jej nepoužívá jiná aplikace.'
          : 'Nahrávání selhalo. Zkuste je zopakovat nebo úkol napište ručně.');
    }
  }

  return { state, error, seconds, start, stop, cancel, busy: ['requestingPermission', 'recording', 'transcribing'].includes(state) };
}
