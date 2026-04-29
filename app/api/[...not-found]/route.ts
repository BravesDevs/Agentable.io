import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function PUT() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function PATCH() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function DELETE() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
