import { NextResponse } from 'next/server';import { upsertOccupancy } from '@/lib/store';
export async function POST(req:Request){ return NextResponse.json(upsertOccupancy(await req.json()),{status:201}); }
export async function PUT(req:Request){ return NextResponse.json(upsertOccupancy(await req.json())); }
