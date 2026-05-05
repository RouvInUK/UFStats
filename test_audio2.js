import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';
env.allowLocalModels = false;

async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  
  // Create an array with some random noise and a fake "pass" sound (just random)
  let fakeAudio = new Float32Array(16000 * 2);
  for (let i = 0; i < fakeAudio.length; i++) {
    fakeAudio[i] = (Math.random() * 2 - 1) * 0.1; 
  }

  console.log("Transcribing noise audio...");
  try {
    let output = await transcriber(fakeAudio, { 
      language: 'english', 
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false
    });
    console.log("Output noise:", output);
  } catch(e) { console.error("Error noise:", e); }
}
run().catch(console.error);
