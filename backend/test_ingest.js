// Quick validation script for Part 8 ingestion API
const http = require('http');

function postJson(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 4000,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(respData) });
          } catch {
            resolve({ status: res.statusCode, body: respData });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('--- Test 1: Batch Upload with Out-of-Order Timestamps ---');
  const batchPayload = {
    readings: [
      {
        device_id: 'ESP32-S4',
        station_id: 'S4',
        api_key: 'indrayani-key-s4',
        timestamp: '2026-09-19T10:35:00Z',
        ph: 7.1,
        do: 4.8,
        turbidity: 22.0,
        tds: 310,
        conductivity: 580,
        temperature: 26.5,
      },
      {
        device_id: 'ESP32-S4',
        station_id: 'S4',
        api_key: 'indrayani-key-s4',
        timestamp: '2026-09-19T10:30:00Z', // older timestamp
        ph: 7.2,
        do: 5.0,
        turbidity: 19.0,
        tds: 300,
        conductivity: 560,
        temperature: 26.4,
      },
      {
        device_id: 'ESP32-S4',
        station_id: 'S4',
        api_key: 'indrayani-key-s4',
        timestamp: '2026-09-19T10:40:00Z',
        ph: 7.0,
        do: 4.5,
        turbidity: 25.0,
        tds: 320,
        conductivity: 600,
        temperature: 26.8,
      },
    ],
  };

  const batchRes = await postJson('/api/ingest', batchPayload);
  console.log('Batch Response Status:', batchRes.status);
  console.log('Batch Response Result:', JSON.stringify(batchRes.body, null, 2));

  console.log('\n--- Test 2: Invalid Parameters (Range Check Rejection) ---');
  const invalidPayload = {
    device_id: 'ESP32-S4',
    station_id: 'S4',
    api_key: 'chikhali_secret_esp32_key',
    ph: 16.5, // Invalid: pH > 14
    do: 4.0,
    turbidity: -8.0, // Invalid: negative
    tds: 200,
    conductivity: 400,
    temperature: 25.0,
  };

  const invalidRes = await postJson('/api/ingest', invalidPayload);
  console.log('Invalid Range Status:', invalidRes.status);
  console.log('Invalid Range Result:', JSON.stringify(invalidRes.body, null, 2));

  console.log('\n--- Test 3: Invalid API Key Rejection ---');
  const badAuthPayload = {
    device_id: 'ESP32-S4',
    station_id: 'S4',
    api_key: 'wrong_secret_key',
    ph: 7.2,
    do: 5.0,
    turbidity: 10.0,
    tds: 200,
    conductivity: 400,
    temperature: 25.0,
  };
  const badAuthRes = await postJson('/api/ingest', badAuthPayload);
  console.log('Bad Auth Status:', badAuthRes.status);
  console.log('Bad Auth Result:', JSON.stringify(badAuthRes.body, null, 2));
}

runTests().catch(console.error);
