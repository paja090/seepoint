import { NextResponse } from 'next/server';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(path.join(process.cwd(), 'public/uploads'), { recursive: true });
  const name = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9_.-]/g, '')}`;
  await writeFile(path.join(process.cwd(), 'public/uploads', name), bytes);

  const photo = await prisma.photo.create({
    data: {
      url: `/uploads/${name}`,
      type: String(form.get('type') ?? 'CARRIER') as 'LOCATION' | 'CARRIER' | 'CAMPAIGN' | 'INSTALLATION' | 'CHECK' | 'ARCHIVE',
      carrierId: form.get('carrierId') ? String(form.get('carrierId')) : null,
      surfaceId: form.get('surfaceId') ? String(form.get('surfaceId')) : null,
    },
  });
  return NextResponse.json(photo, { status: 201 });
}
