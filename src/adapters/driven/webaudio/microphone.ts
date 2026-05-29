import type {
  AudioChunk,
  MicError,
  MicStatus,
  Microphone,
  Result,
} from '../../../core/ports/driven/Microphone.js';

const CHUNK_SIZE = 2048;

export function createWebAudioMicrophone(): Microphone {
  let status: MicStatus = 'idle';
  let context: AudioContext | null = null;
  let stream: MediaStream | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let onChunkCb: ((c: AudioChunk) => void) | null = null;

  return {
    status: () => status,
    async start(onChunk): Promise<Result<void, MicError>> {
      if (status === 'streaming') {
        onChunkCb = onChunk;
        return { ok: true, value: undefined };
      }
      status = 'requesting';
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch (err) {
        status = 'denied';
        const message = err instanceof Error ? err.message : String(err);
        if (message.toLowerCase().includes('denied')) {
          return { ok: false, error: { kind: 'denied', message } };
        }
        return { ok: false, error: { kind: 'unavailable', message } };
      }

      try {
        const AudioCtx =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        context = new AudioCtx({ latencyHint: 'interactive' });
        source = context.createMediaStreamSource(stream);
        processor = context.createScriptProcessor(CHUNK_SIZE, 1, 1);
        onChunkCb = onChunk;
        processor.onaudioprocess = (event) => {
          if (!onChunkCb || !context) return;
          const input = event.inputBuffer.getChannelData(0);
          const copy = new Float32Array(input);
          onChunkCb({
            samples: copy,
            sampleRate: context.sampleRate,
            timestamp: performance.now(),
          });
        };
        source.connect(processor);
        processor.connect(context.destination);
        status = 'streaming';
        return { ok: true, value: undefined };
      } catch (err) {
        status = 'error';
        return {
          ok: false,
          error: {
            kind: 'unknown',
            message: err instanceof Error ? err.message : String(err),
          },
        };
      }
    },
    stop() {
      onChunkCb = null;
      processor?.disconnect();
      source?.disconnect();
      stream?.getTracks().forEach((t) => t.stop());
      void context?.close();
      processor = null;
      source = null;
      stream = null;
      context = null;
      status = 'idle';
    },
  };
}
