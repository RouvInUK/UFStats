import { pipeline, env } from '@xenova/transformers';
env.allowLocalModels = false;
async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  let fakeAudio = new Float32Array(16000 * 1.5); // 1.5 seconds
  console.log("Testing with chunk_length_s...");
  try {
    let output = await transcriber(fakeAudio, { 
      language: 'english', 
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false
    });
    console.log("Output:", output);
  } catch(e) { console.error("Error:", e); }
}
run().catch(console.error);
