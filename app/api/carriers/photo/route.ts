import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const damageTypeLabels: Record<string, { label: string; icon: string }> = {
  OVERGROWN: { label: '🌳 Zarostlá – nutný prořez stromů/keřů', icon: '🌳' },
  TURNED: { label: '🔄 Vytočená / hnutá konstrukce', icon: '🔄' },
  FADED: { label: '☀️ Vybledlý tisk / poničený motiv', icon: '☀️' },
  DAMAGED_STRUCTURE: { label: '🚨 Poškozená konstrukce / prasklé sklo', icon: '🚨' },
  LIGHTING_OFF: { label: '💡 Nesvítí osvětlení', icon: '💡' },
  OTHER: { label: '⚠️ Jiná závada / poškození', icon: '⚠️' },
};

const sideLabels: Record<string, string> = {
  SIDE_A: '🅰️ Strana A (Přední)',
  SIDE_B: '🅱️ Strana B (Zadní)',
  BOTH: '🔀 Obě strany (A i B)',
};

const purposeLabels: Record<string, string> = {
  CLIENT_REPORT: '📸 Doložení výlepu pro klienta',
  DAMAGE: '🚨 Poškození / Závada na ploše',
  INSPECTION: '🧹 Pravidelná kontrola / Údržba',
  MOTIF_CHANGE: '🔄 Výměna motivu / Přelep',
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Nejste přihlášeni.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    carrierId: string;
    side: 'SIDE_A' | 'SIDE_B' | 'BOTH';
    purpose: 'CLIENT_REPORT' | 'DAMAGE' | 'INSPECTION' | 'MOTIF_CHANGE';
    damageType?: string;
    note?: string;
    imageUrl: string;
  } | null;

  if (!body || !body.carrierId || !body.imageUrl || !body.purpose) {
    return NextResponse.json(
      { error: 'Chybí povinné údaje (nosič, fotka, účel).' },
      { status: 400 }
    );
  }

  const carrier = await prisma.advertisingCarrier.findUnique({
    where: { id: body.carrierId },
  });

  if (!carrier) {
    return NextResponse.json({ error: 'Nosič nebyl nalezen.' }, { status: 404 });
  }

  const sideText = sideLabels[body.side] || body.side;
  const purposeText = purposeLabels[body.purpose] || body.purpose;
  const damageText = body.damageType ? damageTypeLabels[body.damageType]?.label || body.damageType : '';

  // 1. Create Photo record
  const photoNoteParts = [
    `Účel: ${purposeText}`,
    `Strana: ${sideText}`,
    damageText ? `Závada: ${damageText}` : null,
    body.note ? `Poznámka: ${body.note}` : null,
  ].filter(Boolean);

  const photo = await prisma.photo.create({
    data: {
      carrierId: carrier.id,
      url: body.imageUrl,
      type: 'CARRIER',
      note: photoNoteParts.join(' | '),
      capturedByWorkerUserId: user.id,
      capturedByWorkerName: user.name,
      isClientVisible: body.purpose === 'CLIENT_REPORT',
    },
  });

  // 2. If purpose is DAMAGE, auto-post urgent message to Team Chat
  let chatMessage = null;
  if (body.purpose === 'DAMAGE') {
    const chatContent = [
      `🚨 **HLÁŠENÍ ZÁVADY NA PLOŠE**`,
      `📍 **Nosič:** ${carrier.name} (${carrier.code}) – ${carrier.city}`,
      `📐 **Strana:** ${sideText}`,
      damageText ? `⚠️ **Typ závady:** ${damageText}` : null,
      body.note ? `📝 **Poznámka z terénu:** ${body.note}` : null,
      `👤 **Nahlásil/a:** ${user.name}`,
    ]
      .filter(Boolean)
      .join('\n');

    chatMessage = await prisma.chatMessage.create({
      data: {
        channel: 'urgent',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        content: chatContent,
        imageUrl: body.imageUrl,
      },
    });

    // Optionally update carrier note with damage warning
    const updatedNote = `[🚨 ZÁVADA: ${damageText || 'Poškozeno'} (${sideText})] ${body.note || ''} | ${carrier.note || ''}`.trim();
    await prisma.advertisingCarrier.update({
      where: { id: carrier.id },
      data: { note: updatedNote.slice(0, 500) },
    });
  } else if (body.purpose === 'CLIENT_REPORT') {
    // Post to installations channel for client proof
    const chatContent = [
      `📸 **DOLOŽENÍ VÝLEPU PRO KLIENTA**`,
      `📍 **Nosič:** ${carrier.name} (${carrier.code}) – ${carrier.city}`,
      `📐 **Strana:** ${sideText}`,
      body.note ? `📝 **Poznámka:** ${body.note}` : null,
      `👤 **Vyfotil/a:** ${user.name}`,
    ]
      .filter(Boolean)
      .join('\n');

    await prisma.chatMessage.create({
      data: {
        channel: 'installations',
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        content: chatContent,
        imageUrl: body.imageUrl,
      },
    });
  }

  return NextResponse.json({
    ok: true,
    photoId: photo.id,
    chatMessageId: chatMessage?.id,
    message: body.purpose === 'DAMAGE'
      ? 'Závada byla úspěšně nahlášena a odeslána týmu do Chatu (Urgentní)!'
      : 'Fotografie byla úspěšně uložena k nosiči!',
  });
}
