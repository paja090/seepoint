import { NextResponse } from 'next/server';import { deleteCarrier, getCarrier, upsertCarrier } from '@/lib/store';
export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){ const c=getCarrier((await params).id); return c?NextResponse.json(c):NextResponse.json({error:'Not found'},{status:404}); }
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){ return NextResponse.json(upsertCarrier({...(await req.json()),id:(await params).id})); }
export async function DELETE(_:Request,{params}:{params:Promise<{id:string}>}){ deleteCarrier((await params).id); return NextResponse.json({ok:true}); }
