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
        // Force the model to focus on English
        language: 'english',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });
      self.postMessage({ type: 'transcribed', payload: output.text });
    } catch (err) {
      console.error("Worker transcription error:", err);
      self.postMessage({ type: 'status', status: 'error', error: err.message });
    }
  }
};
