import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';
env.allowLocalModels = false;

async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  
  // Read WAV file and convert to Float32Array
  let buffer = fs.readFileSync('jfk.wav');
  let wavData = buffer.slice(44); // skip simple header
  let float32Array = new Float32Array(wavData.length / 2);
  for (let i = 0; i < float32Array.length; i++) {
    let int16 = wavData.readInt16LE(i * 2);
    float32Array[i] = int16 / 32768.0;
  }

  console.log("Transcribing JFK...", float32Array.length);
  try {
    let output1 = await transcriber(float32Array, { 
      language: 'english', 
      task: 'transcribe',
      return_timestamps: false
    });
    console.log("Output1:", output1);
  } catch(e) { console.error("Error1:", e); }
}
run().catch(console.error);
