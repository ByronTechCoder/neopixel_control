import { NextRequest, NextResponse } from 'next/server'

const GITHUB_PAT = process.env.GITHUB_PAT
const GITHUB_REPO = process.env.GITHUB_REPO || 'ByronTechCoder/neopixel_control'
const API_URL = `https://api.github.com/repos/${GITHUB_REPO}/contents/schedules.json`

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_PAT}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  }
}

export async function GET() {
  if (!GITHUB_PAT) {
    return NextResponse.json({ error: 'GITHUB_PAT not configured.' }, { status: 500 })
  }

  const res = await fetch(API_URL, { headers: headers(), cache: 'no-store' })

  if (res.status === 404) {
    return NextResponse.json({ version: 1, schedules: [] })
  }
  if (!res.ok) {
    return NextResponse.json({ error: `GitHub API error ${res.status}` }, { status: res.status })
  }

  const file = await res.json()
  const content = Buffer.from(file.content, 'base64').toString('utf8')
  return NextResponse.json(JSON.parse(content))
}

export async function POST(request: NextRequest) {
  if (!GITHUB_PAT) {
    return NextResponse.json({ error: 'GITHUB_PAT not configured.' }, { status: 500 })
  }

  const body = await request.json()
  const { schedules } = body

  if (!Array.isArray(schedules)) {
    return NextResponse.json({ error: 'schedules must be an array.' }, { status: 400 })
  }

  // Fetch current file to get SHA and preserve existing fields (e.g. version)
  const getRes = await fetch(API_URL, { headers: headers(), cache: 'no-store' })
  if (getRes.status === 404) {
    // File doesn't exist yet — will be created
    const encoded = Buffer.from(
      JSON.stringify({ version: 1, schedules }, null, 2)
    ).toString('base64')
    const putRes = await fetch(API_URL, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        message: 'chore: create alert schedules [skip ci]',
        content: encoded,
      }),
    })
    if (!putRes.ok) {
      const text = await putRes.text()
      return NextResponse.json({ error: `GitHub API error ${putRes.status}: ${text}` }, { status: putRes.status })
    }
    return NextResponse.json({ success: true })
  }
  if (!getRes.ok) {
    return NextResponse.json({ error: `GitHub API error ${getRes.status}` }, { status: getRes.status })
  }

  const file = await getRes.json()
  const existing = JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))
  const encoded = Buffer.from(
    JSON.stringify({ ...existing, schedules }, null, 2)
  ).toString('base64')

  const putRes = await fetch(API_URL, {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify({
      message: 'chore: update alert schedules [skip ci]',
      content: encoded,
      sha: file.sha,
    }),
  })

  if (!putRes.ok) {
    const text = await putRes.text()
    return NextResponse.json(
      { error: `GitHub API error ${putRes.status}: ${text}` },
      { status: putRes.status }
    )
  }

  return NextResponse.json({ success: true })
}
