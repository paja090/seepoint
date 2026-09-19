import { requireApiAccess, isApiDenied } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { logAIUsage } from '@/lib/ai-usage';
import { getGeminiApiKey } from '@/lib/ai-gemini';
import { assertOrganizationId, TenantContextError } from '@/lib/tenant-context';
import { normalizeQuickTasks } from '@/lib/quick-task-parsing';

export const dynamic = 'force-dynamic';
export const maxDuration = 40;

const PREFERRED_MODELS = ['gemini-3.6-flash', 'gemini-flash-latest', 'gemini-3.5-flash'];

export async function POST(request: Request) {
  let organizationId: string | null = null;
  let userId: string | null = null;
  let phase = 'parsing';
  let usedModel = 'local-fallback';
  const logError = (message: string, model = usedModel) => console.error('quick-task-ai', { endpoint: '/api/ai/parse-quick-tasks', organizationId, userId, phase, provider: 'gemini', model, error: message });
  try {
    const actor=await requireApiAccess('myTasks', 'myTasks');if(isApiDenied(actor))return actor;
    if (!actor) {
      return NextResponse.json({ error: 'Přihlášení vyžadováno.' }, { status: 401 });
    }

    organizationId = actor.organizationId;
    userId = actor.id;
    if (!organizationId) return NextResponse.json({ error: 'Vyberte aktivní organizaci.' }, { status: 403 });

    const { prompt, defaultAssigneeId, organizationId: requestedOrganizationId } = (await request.json().catch(() => ({}))) as {
      organizationId?: string;
      prompt?: string;
      defaultAssigneeId?: string;
    };

    assertOrganizationId(requestedOrganizationId, organizationId);
    if (typeof prompt === 'string' && prompt.length > 10000) return NextResponse.json({ error: 'Zadání je příliš dlouhé.' }, { status: 400 });
    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Zadejte nebo namluvte zadání úkolů.' }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({
      where: { isActive: true, organizationId },
      select: { id: true, firstName: true, lastName: true, position: true, userId: true },
    });

    const activeEmployeeIds = new Set(employees.map(employee => employee.id));
    if (defaultAssigneeId !== undefined && (typeof defaultAssigneeId !== 'string' || !activeEmployeeIds.has(defaultAssigneeId))) {
      return NextResponse.json({ error: 'Vybraný zaměstnanec není aktivní v této organizaci.' }, { status: 403 });
    }
    if (!employees.length) return NextResponse.json({ error: 'Organizace nemá aktivního zaměstnance pro přiřazení úkolů.' }, { status: 409 });

    // Find current user's employee profile
    const actorEmployee = employees.find((e) => e.userId === actor.id || e.id === actor.employee?.id) || employees[0];

    const employeeListStr = employees
      .map(
        (e) =>
          `- ID: "${e.id}", Jméno: "${e.firstName} ${e.lastName}" (${e.position || 'Pracovník'})${
            e.id === actorEmployee?.id ? ' [PŘIHLÁŠENÝ UŽIVATEL / SÁM SOBĚ]' : ''
          }`
      )
      .join('\n');

    const apiKey = getGeminiApiKey();
    let parsedTasks: Array<{
      title: string;
      description?: string;
      assignedToEmployeeId?: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      dueDate?: string;
    }> = [];

    if (apiKey) {
      const systemPrompt = `Jsi inteligentní asistent pro rozdělování interních provozních úkolů na dílně a ve firmě.
Tvým HLAVNÍM ÚKOLEM je vzít volný mluvený text/záznam hlasu od vedoucího a ROZPADNOUT HO na jednotlivé samostatné úkoly (Check-list položky).

PŘÍKLAD VSTUPU: "Pavel zítra ráno zamete halu u vrat a odpoledne skočí do Hornbachu pro barvu a ještě uklidí ponk u pily"
PŘÍKLAD VÝSTUPU: 3 samostatné úkoly:
1. Zamést halu u vrat
2. Koupit barvu v Hornbachu
3. Uklidit ponk u pily

Seznam aktivních zaměstnanců ve firmě:
${employeeListStr}

PRAVIDLA PRO ROZPOZNÁNÍ ZAMĚSTNANCE:
1. Pokud text obsahuje slovíčka jako "já", "pro mě", "sebe", "sám sobě", "naplánovat sobě", přiřaď úkol přihlášenému uživateli ID "${actorEmployee?.id}".
2. Pokud v textu zazní jméno (např. Petr, Pavel, Milan), přiřaď úkol danému zaměstnanci.
3. Pokud zaměstnanec z textu nevyplývá a nebylo specifikováno jméno, použij jako výchozího zaměstnance ID "${defaultAssigneeId || actorEmployee?.id}".

Vracíš POUZE platný JSON objekt ve tvaru:
{
  "tasks": [
    {
      "title": "Stručný konkrétní samostatný úkol (např. Zamést halu u vrat)",
      "description": "Podrobnější instrukce nebo upřesnění termínu (volitelné)",
      "assignedToEmployeeId": "ID zaměstnance ze seznamu",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "dueDate": "YYYY-MM-DD nebo null"
    }
  ]
}
Vrať čisté JSON bez jakýchkoliv markdown backticků.`;

      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(25_000)]);
      for (const modelName of PREFERRED_MODELS) {
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
              signal,
              body: JSON.stringify({
                contents: [
                  {
                    parts: [{ text: `${systemPrompt}\n\nZadání vedoucího:\n"${prompt}"` }],
                  },
                ],
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
              parsedTasks = parsed.tasks;
              usedModel = modelName;
              break; // Success!
            }
          } else { logError(`Gemini HTTP ${response.status}`, modelName); }
        } catch (e) {
          logError(e instanceof Error ? e.message : 'Provider request failed', modelName);
          if (signal.aborted) break;
        }
      }

      if (parsedTasks && parsedTasks.length > 0 && actor.organizationId) {
        await logAIUsage({
          organizationId: actor.organizationId,
          userId: actor.id,
          feature: 'ASSISTANT',
          modelName: usedModel,
          promptTokens: 400,
          outputTokens: 200,
          costEstimateUsd: 0.001,
          metadata: { action: 'quick-tasks-parse', taskCount: parsedTasks.length },
        });
      }
    }

    // Smart sentence splitting fallback if AI failed or returned only 1 task when prompt contains conjunctions
    if (parsedTasks.length === 0) {
      const splitPhrases = prompt
        .split(/(?:\r?\n|;|\.\s+|,| a ještě | a pak | a také | a taky | a dál | a potom |\s+a\s+)/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 3);

      let matchedEmp = defaultAssigneeId
        ? employees.find((e) => e.id === defaultAssigneeId)
        : actorEmployee || employees[0];

      for (const emp of employees) {
        const fullName = `${emp.firstName} ${emp.lastName}`.toLowerCase();
        if (prompt.toLowerCase().includes(emp.firstName.toLowerCase()) || prompt.toLowerCase().includes(fullName)) {
          matchedEmp = emp;
          break;
        }
      }

      if (splitPhrases.length > 1) {
        for (const phrase of splitPhrases) {
          parsedTasks.push({
            title: phrase.slice(0, 100),
            assignedToEmployeeId: matchedEmp?.id,
            priority: 'MEDIUM',
          });
        }
      } else {
        parsedTasks.push({
          title: prompt.trim().slice(0, 100),
          description: prompt.length > 100 ? prompt.trim() : undefined,
          assignedToEmployeeId: matchedEmp?.id,
          priority: 'MEDIUM',
        });
      }
    }

    // Validate all model output before any write; avoid partially created checklists.
    const safeTasks = normalizeQuickTasks(parsedTasks, activeEmployeeIds, defaultAssigneeId || actorEmployee!.id);
    if (!safeTasks.length) return NextResponse.json({ error: 'AI nevrátila platné úkoly. Upravte zadání a zkuste to znovu.' }, { status: 502 });
    phase = 'db';
    const activeOrganizationId = organizationId;
    const createdTasks = await prisma.$transaction(safeTasks.map(taskData => prisma.quickInternalTask.create({
        data: { ...taskData, organizationId: activeOrganizationId, createdByUserId: actor.id, status: 'PENDING' },
        include: {
          assignedToEmployee: { select: { id: true, firstName: true, lastName: true, position: true } },
          createdByUser: { select: { id: true, name: true, email: true } },
        },
      })));

    return NextResponse.json({ ok: true, createdCount: createdTasks.length, tasks: createdTasks });
  } catch (err: unknown) {
    if (err instanceof TenantContextError) return NextResponse.json({ error: 'Organizace neodpovídá aktivnímu přihlášení.' }, { status: 403 });
    logError(err instanceof Error ? err.message : 'Unknown error');
    return NextResponse.json({ error: 'Úkoly se nepodařilo vytvořit. Zkuste to znovu.' }, { status: 500 });
  }
}
