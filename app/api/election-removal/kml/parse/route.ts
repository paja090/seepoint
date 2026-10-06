import { NextResponse } from 'next/server';
import {
  requireElectionRemovalAccess,
  isElectionRemovalAccessDenied,
} from '@/lib/election-removal/guard';
import { parseGoogleMyMapsKml } from '@/lib/election-removal/kml-parser';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const auth = await requireElectionRemovalAccess();
  if (isElectionRemovalAccessDenied(auth)) return auth;

  try {
    const contentType = req.headers.get('content-type') || '';
    let kmlContent = '';
    let fileName = 'import.kml';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file');

      if (!file || !(file instanceof Blob)) {
        return NextResponse.json(
          { error: 'Nebyl nahrán žádný KML soubor.' },
          { status: 400 }
        );
      }

      if ('name' in file && typeof file.name === 'string') {
        fileName = file.name;
      }

      kmlContent = await file.text();
    } else if (contentType.includes('application/json')) {
      const body = await req.json();
      if (!body.kmlContent || typeof body.kmlContent !== 'string') {
        return NextResponse.json(
          { error: 'Chybí obsah KML souboru.' },
          { status: 400 }
        );
      }
      kmlContent = body.kmlContent;
      if (body.fileName) fileName = body.fileName;
    } else {
      kmlContent = await req.text();
    }

    if (!kmlContent || kmlContent.trim().length === 0) {
      return NextResponse.json(
        { error: 'KML soubor je prázdný.' },
        { status: 400 }
      );
    }

    const parseResult = parseGoogleMyMapsKml(kmlContent);

    return NextResponse.json({
      success: true,
      fileName,
      parseResult,
    });
  } catch (error: unknown) {
    console.error('Chyba při parsování KML:', error);
    const message =
      error instanceof Error ? error.message : 'Chyba při zpracování KML souboru.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
