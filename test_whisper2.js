import { pipeline, env } from '@xenova/transformers';
env.allowLocalModels = false;
async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  let fakeAudio = new Float32Array(16000 * 2);
  console.log("Testing language: 'english'...");
  try {
    let output = await transcriber(fakeAudio, { language: 'english', task: 'transcribe' });
    console.log("Output english:", output);
  } catch(e) { console.error("Error english:", e); }
}
run().catch(console.error);
