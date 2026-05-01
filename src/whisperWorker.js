import { pipeline, env } from '@xenova/transformers';

// Disable local models to rely entirely on caching the remote HuggingFace model
env.allowLocalModels = false;

let transcriber = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'load') {
    try {
      self.postMessage({ type: 'status', status: 'loading' });
      
      // Load the model and pass a progress callback
      transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
        progress_callback: (data) => {
          self.postMessage({ type: 'progress', payload: data });
        }
      });
      
      self.postMessage({ type: 'status', status: 'ready' });
    } catch (err) {
      console.error("Worker load error:", err);
      self.postMessage({ type: 'status', status: 'error', error: err.message });
    }
  }

  if (type === 'transcribe') {
    if (!transcriber) {
      self.postMessage({ type: 'status', status: 'error', error: 'Model not loaded yet' });
      return;
    }
    try {
      // payload is expected to be a Float32Array at 16000 Hz
      const output = await transcriber(payload, {
        language: 'english',
        task: 'transcribe',
        return_timestamps: false,
      });
      
      let transcriptText = '';
      if (typeof output === 'string') {
          transcriptText = output;
      } else if (Array.isArray(output)) {
          transcriptText = output.map(chunk => chunk.text || '').join(' ');
      } else if (output && typeof output === 'object') {
          transcriptText = output.text || '';
      }
      
      self.postMessage({ type: 'transcribed', payload: transcriptText });
    } catch (err) {
      console.error("Worker transcription error:", err);
      self.postMessage({ type: 'status', status: 'error', error: err.message });
    }
  }
};
