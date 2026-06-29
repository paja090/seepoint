import { NextResponse } from 'next/server';import { store, upsertCarrier } from '@/lib/store';
export async function GET(){ return NextResponse.json(store.carriers); }
export async function POST(req: Request){ return NextResponse.json(upsertCarrier(await req.json()),{status:201}); }
