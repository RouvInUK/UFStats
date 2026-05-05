import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';
env.allowLocalModels = false;

async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  
  // 1 second of random noise
  let fakeAudio = new Float32Array(16000 * 1);
  for (let i = 0; i < fakeAudio.length; i++) {
    fakeAudio[i] = (Math.random() * 2 - 1) * 0.1; 
  }

  console.log("Transcribing with NO chunk_length_s...");
  try {
    let output1 = await transcriber(fakeAudio, { 
      language: 'english', 
      task: 'transcribe',
      return_timestamps: false
    });
    console.log("Output1:", output1);
  } catch(e) { console.error("Error1:", e); }
  
  console.log("Transcribing WITH chunk_length_s...");
  try {
    let output2 = await transcriber(fakeAudio, { 
      language: 'english', 
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false
    });
    console.log("Output2:", output2);
  } catch(e) { console.error("Error2:", e); }
}
run().catch(console.error);
