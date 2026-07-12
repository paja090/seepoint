import { NextResponse } from 'next/server';
import { listImagesInFolder } from '@/lib/google-drive';

export async function GET() {
  // Never allow in production
  if (process.env.VERCEL_ENV === 'production') {
    return new Response('Forbidden', { status: 403 });
  }

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) {
    return NextResponse.json({ error: 'Missing GOOGLE_DRIVE_FOLDER_ID environment variable' });
  }

  try {
    const files = await listImagesInFolder(folderId);
    return NextResponse.json({
      success: true,
      folderId,
      filesCount: files.length,
      firstFile: files[0] ?? null,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || String(error),
      stack: error.stack,
    });
  }
}
