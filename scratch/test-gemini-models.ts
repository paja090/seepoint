async function checkModelExists(modelName: string) {
  const dummyKey = 'AIzaSyDummyKeyForTestingModelNames12345678';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${dummyKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
  });

  const text = await res.text();
  const exists = res.status === 400; // 400 = key invalid / quota, but model exists! 404 = model not found!
  console.log(`[${modelName.padEnd(25)}] HTTP ${res.status} | Exists: ${exists ? 'YES ✅' : 'NO ❌'} | Msg: ${text.slice(0, 70)}`);
}

async function run() {
  const candidates = [
    'gemini-1.5-flash',
    'gemini-1.5-flash-latest',
    'gemini-1.5-pro',
    'gemini-1.5-pro-latest',
    'gemini-2.0-flash',
    'gemini-2.0-flash-exp',
    'gemini-2.0-flash-lite',
    'gemini-2.0-pro-exp-02-05',
    'gemini-flash',
    'gemini-pro',
  ];

  console.log('=== VERIFYING EXACT GOOGLE API MODEL NAMES ===');
  for (const m of candidates) {
    await checkModelExists(m);
  }
}

run();
