import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';
env.allowLocalModels = false;

async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  
  // Read WAV file and convert to Float32Array
  let buffer = fs.readFileSync('speech.wav');
  // Simple wav parser for 16kHz 16-bit mono
  let wavData = buffer.slice(44); 
  let float32Array = new Float32Array(wavData.length / 2);
  let max = 0;
  for (let i = 0; i < float32Array.length; i++) {
    let int16 = wavData.readInt16LE(i * 2);
    let f = int16 / 32768.0;
    float32Array[i] = f;
    if (Math.abs(f) > max) max = Math.abs(f);
  }
  
  // Normalize
  if (max > 0) {
    let scale = 1.0 / max;
    for (let i = 0; i < float32Array.length; i++) float32Array[i] *= scale;
  }

  console.log("Transcribing short speech...", float32Array.length, "samples");
  try {
    let output1 = await transcriber(float32Array, { 
      language: 'english', 
      task: 'transcribe',
      return_timestamps: false
    });
    console.log("Output NO chunking:", output1);
  } catch(e) { console.error("Error1:", e); }
  
  try {
    let output2 = await transcriber(float32Array, { 
      language: 'english', 
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false
    });
    console.log("Output WITH chunking:", output2);
  } catch(e) { console.error("Error2:", e); }
}
run().catch(console.error);
