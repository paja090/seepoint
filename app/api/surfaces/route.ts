import { NextResponse } from 'next/server';import { upsertSurface } from '@/lib/store';
export async function POST(req:Request){ return NextResponse.json(upsertSurface(await req.json()),{status:201}); }
export async function PUT(req:Request){ return NextResponse.json(upsertSurface(await req.json())); }
