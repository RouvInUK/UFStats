import { pipeline, env } from '@xenova/transformers';
env.allowLocalModels = false;
async function run() {
  console.log("Loading model...");
  let transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
  console.log("Model loaded. Testing fake audio...");
  let fakeAudio = new Float32Array(16000 * 2); // 2 seconds of silence
  let output = await transcriber(fakeAudio, { language: 'en', task: 'transcribe' });
  console.log("Output:", output);
}
run().catch(console.error);
