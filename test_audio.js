import { pipeline, env } from '@xenova/transformers';
env.allowLocalModels = false;

async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  
  // Generate 1 second of a 440Hz sine wave (simulated speech)
  let fakeAudio = new Float32Array(16000 * 1);
  for (let i = 0; i < fakeAudio.length; i++) {
    fakeAudio[i] = Math.sin(2 * Math.PI * 440 * i / 16000);
  }

  console.log("Transcribing fake audio...");
  try {
    let output = await transcriber(fakeAudio, { 
      language: 'en', 
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false
    });
    console.log("Output:", output);
  } catch(e) { console.error("Error:", e); }
}
run().catch(console.error);
