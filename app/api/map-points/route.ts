import { NextResponse } from 'next/server';import { carrierMapColor, carriers } from '@/lib/mock-data';
export async function GET(){ return NextResponse.json(carriers.map(c=>({id:c.id,name:c.name,code:c.code,type:c.type,latitude:c.latitude,longitude:c.longitude,city:c.city,status:c.status,color:carrierMapColor(c)}))); }
