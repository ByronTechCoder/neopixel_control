'use strict';

const GUARD_MS = 290_000;

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
    roundedMinute: Math.floor(get('minute') / 5) * 5,
  };
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
    'User-Agent': 'neopixel-alert-scheduler/1.0',
  };
}

function b64decode(str) {
  const binary = atob(str.replace(/\n/g, ''));
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function fetchSchedules(token, repo) {
  const url = `https://api.github.com/repos/${repo}/contents/schedules.json`;
  const res = await fetch(url, { headers: ghHeaders(token) });
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const file = await res.json();
  return { data: JSON.parse(b64decode(file.content)), sha: file.sha };
}

async function fireAlert(username, key, feed) {
  const url = `https://io.adafruit.com/api/v2/${username}/feeds/${feed}/data`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'X-AIO-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ value: 'alert' }),
  });
  if (res.ok || res.status === 201) return true;
  console.error(`AIO error ${res.status}: ${await res.text()}`);
  return false;
}

async function writeBack(token, repo, updates) {
  const { data, sha } = await fetchSchedules(token, repo);
  for (const { id, last_fired_at, repeatable } of updates) {
    const s = data.schedules.find(s => s.id === id);
    if (s) {
      s.last_fired_at = last_fired_at;
      if (!repeatable) s.enabled = false;
    }
  }
  const url = `https://api.github.com/repos/${repo}/contents/schedules.json`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: ghHeaders(token),
    body: JSON.stringify({
      message: 'chore: update schedule last_fired_at [skip ci]',
      content: b64encode(JSON.stringify(data, null, 2)),
      sha,
    }),
  });
  if (!res.ok) throw new Error(`GitHub PUT failed: ${res.status} ${await res.text()}`);
}

export default {
  async scheduled(event, env, ctx) {
    const { AIO_USERNAME, AIO_KEY, GITHUB_TOKEN } = env;
    const feed = env.AIO_FEED || 'neopixel-pattern';
    const repo = env.GITHUB_REPO || 'ByronTechCoder/neopixel_control';

    if (!AIO_USERNAME || !AIO_KEY || !GITHUB_TOKEN) {
      console.error('Missing required secrets: AIO_USERNAME, AIO_KEY, or GITHUB_TOKEN');
      return;
    }

    const { data } = await fetchSchedules(GITHUB_TOKEN, repo);
    const schedules = data.schedules || [];
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
      const ok = await fireAlert(AIO_USERNAME, AIO_KEY, feed);
      if (ok) {
        updates.push({ id: s.id, last_fired_at: nowISO, repeatable: s.repeatable });
        console.log(`Alert fired${s.repeatable ? '' : ' — one-time, will disable'}`);
      }
    }

    if (updates.length > 0) {
      try {
        await writeBack(GITHUB_TOKEN, repo, updates);
        console.log('Updated schedules.json');
      } catch (e) {
        console.error('Write-back failed:', e.message);
      }
    }
  },
};
