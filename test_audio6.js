import { pipeline, env } from '@xenova/transformers';
import fs from 'fs';
import { execSync } from 'child_process';
env.allowLocalModels = false;

async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  
  // Create test speech
  execSync('say -o speech.aiff "opponent point"');
  execSync('ffmpeg -y -i speech.aiff -ar 16000 -ac 1 -c:a pcm_s16le speech.wav');
  
  let buffer = fs.readFileSync('speech.wav');
  let wavData = buffer.slice(44); 
  let float32Array = new Float32Array(wavData.length / 2);
  for (let i = 0; i < float32Array.length; i++) {
    let int16 = wavData.readInt16LE(i * 2);
    float32Array[i] = int16 / 32768.0;
  }

  console.log("Transcribing...", float32Array.length, "samples");
  try {
    let output = await transcriber(float32Array, { 
      language: 'english', 
      task: 'transcribe',
      return_timestamps: false
    });
    console.log("Output NO chunking:", output);
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
