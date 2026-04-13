import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { pattern, aio_username, aio_key, aio_feed } = body

  const username = aio_username || process.env.AIO_USERNAME
  const key = aio_key || process.env.AIO_KEY
  const feed = aio_feed || process.env.AIO_FEED || 'neopixel-pattern'

  if (!username || !key) {
    return NextResponse.json(
      { error: 'AIO credentials not configured. Set them in .env.local or via the Settings panel.' },
      { status: 400 }
    )
  }

  if (!pattern) {
    return NextResponse.json({ error: 'Pattern value is required.' }, { status: 400 })
  }

  const url = `https://io.adafruit.com/api/v2/${username}/feeds/${feed}/data`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-AIO-Key': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ value: pattern }),
    })

    if (response.ok || response.status === 201) {
      const data = await response.json()
      return NextResponse.json({ success: true, data })
    } else {
      const errorText = await response.text()
      return NextResponse.json(
        { error: `Adafruit.IO error ${response.status}: ${errorText}` },
        { status: response.status }
      )
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Network error: ${msg}` }, { status: 500 })
  }
}
