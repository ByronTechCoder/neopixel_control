'use strict';

const fs = require('fs');

const AIO_USERNAME = process.env.AIO_USERNAME;
const AIO_KEY = process.env.AIO_KEY;
const AIO_FEED = process.env.AIO_FEED || 'neopixel-pattern';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO = process.env.REPO;

const API_URL = `https://api.github.com/repos/${REPO}/contents/schedules.json`;
const GUARD_MS = 290_000; // just under 5 minutes — prevents double-fire across consecutive runs

function getESTTime() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parseInt(parts.find(p => p.type === type).value, 10);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    // Round down to nearest 5-minute mark to tolerate runner latency (cron runs every 5 min)
    roundedMinute: Math.floor(get('minute') / 5) * 5,
  };
}

function ghHeaders() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

async function fetchFile() {
  const res = await fetch(API_URL, { headers: ghHeaders() });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const file = await res.json();
  const data = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  return { data, sha: file.sha };
}

async function fireAlert() {
  const url = `https://io.adafruit.com/api/v2/${AIO_USERNAME}/feeds/${AIO_FEED}/data`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-AIO-Key': AIO_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'alert' }),
  });
  if (res.ok || res.status === 201) return true;
  console.error(`AIO error ${res.status}: ${await res.text()}`);
  return false;
}

async function writeBack(updates) {
  // Re-fetch the latest file to avoid overwriting concurrent changes
  const { data, sha } = await fetchFile();

  for (const { id, last_fired_at, repeatable } of updates) {
    const s = data.schedules.find(s => s.id === id);
    if (s) {
      s.last_fired_at = last_fired_at;
      if (!repeatable) s.enabled = false;
    }
  }

  const encoded = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
  const res = await fetch(API_URL, {
    method: 'PUT',
    headers: ghHeaders(),
    body: JSON.stringify({
      message: 'chore: update schedule last_fired_at [skip ci]',
      content: encoded,
      sha,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${text}`);
  }
}

async function main() {
  if (!AIO_USERNAME || !AIO_KEY) {
    console.error('Missing AIO credentials');
    process.exit(1);
  }

  const localData = JSON.parse(fs.readFileSync('schedules.json', 'utf8'));
  const schedules = localData.schedules || [];
  const est = getESTTime();
  console.log(`EST: ${String(est.hour).padStart(2, '0')}:${String(est.roundedMinute).padStart(2, '0')} (rounded) ${est.month}/${est.day}/${est.year}`);

  const nowMs = Date.now();
  const nowISO = new Date().toISOString();
  const updates = [];

  for (const s of schedules) {
    if (!s.enabled) continue;

    const [h, m] = s.time.split(':').map(Number);
    if (h !== est.hour || m !== est.roundedMinute) continue;
    if (s.month !== null && s.month !== est.month) continue;
    if (s.day   !== null && s.day   !== est.day)   continue;
    if (s.year  !== null && s.year  !== est.year)  continue;

    if (s.last_fired_at && nowMs - new Date(s.last_fired_at).getTime() < GUARD_MS) {
      console.log(`"${s.label}" fired recently, skipping`);
      continue;
    }

    console.log(`Firing alert for "${s.label}" (${s.time} EST)`);
    const ok = await fireAlert();
    if (ok) {
      updates.push({ id: s.id, last_fired_at: nowISO, repeatable: s.repeatable });
      console.log(`Alert fired${s.repeatable ? '' : ' — schedule is one-time, will disable'}`);
    }
  }

  if (updates.length > 0 && GITHUB_TOKEN && REPO) {
    try {
      await writeBack(updates);
      console.log('Updated schedules.json');
    } catch (e) {
      console.error('Write-back failed:', e.message);
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
