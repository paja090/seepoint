import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUser();
    if (!actor) {
      return NextResponse.json({ error: 'Přihlášení vyžadováno.' }, { status: 401 });
    }

    const { prompt, defaultAssigneeId } = (await request.json().catch(() => ({}))) as {
      prompt?: string;
      defaultAssigneeId?: string;
    };

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Zadejte nebo namluvte zadání úkolů.' }, { status: 400 });
    }

    const employees = await prisma.employee.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, position: true, userId: true },
    });

    // Find current user's employee profile
    const actorEmployee = employees.find((e) => e.userId === actor.id || e.id === actor.employee?.id) || employees[0];

    const employeeListStr = employees
      .map((e) => `- ID: "${e.id}", Jméno: "${e.firstName} ${e.lastName}" (${e.position || 'Pracovník'})${e.id === actorEmployee?.id ? ' [PŘIHLÁŠENÝ UŽIVATEL / SÁM SOBĚ]' : ''}`)
      .join('\n');

    const apiKey = process.env.GEMINI_API_KEY;
    let parsedTasks: Array<{
      title: string;
      description?: string;
      assignedToEmployeeId?: string;
      priority: 'LOW' | 'MEDIUM' | 'HIGH';
      dueDate?: string;
    }> = [];

    if (apiKey) {
      const systemPrompt = `Jsi inteligentní asistent pro rozdělování interních provozních úkolů na dílně a ve firmě.
Tvým úkolem je vzít volný text/záznam hlasu od vedoucího a rozpadnout ho na jednotlivé konkrétní samostatně zaškrtávací položky (Check-list úkolů).

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
      "title": "Stručný konkrétní úkol (např. Zamést halu u vrat)",
      "description": "Podrobnější instrukce nebo poznámka (volitelné)",
      "assignedToEmployeeId": "ID zaměstnance ze seznamu",
      "priority": "HIGH" | "MEDIUM" | "LOW",
      "dueDate": "YYYY-MM-DD nebo null"
    }
  ]
}
Vrať čisté JSON bez jakýchkoliv markdown backticků.`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
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
        try {
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed.tasks)) {
            parsedTasks = parsed.tasks;
          }
        } catch (e) {
          console.error('AI JSON parse error:', e);
        }
      }
    }

    // Fallback if AI or API failed or gave no tasks
    if (parsedTasks.length === 0) {
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

      parsedTasks.push({
        title: prompt.trim().slice(0, 100),
        description: prompt.length > 100 ? prompt.trim() : undefined,
        assignedToEmployeeId: matchedEmp?.id,
        priority: 'MEDIUM',
      });
    }

    // Save tasks to DB
    const createdTasks = [];
    for (const taskData of parsedTasks) {
      const empId = taskData.assignedToEmployeeId || defaultAssigneeId || actorEmployee?.id || employees[0]?.id;
      if (!empId) continue;

      const created = await prisma.quickInternalTask.create({
        data: {
          title: taskData.title,
          description: taskData.description || null,
          assignedToEmployeeId: empId,
          createdByUserId: actor.id,
          priority: taskData.priority || 'MEDIUM',
          dueDate: taskData.dueDate ? new Date(taskData.dueDate) : null,
          status: 'PENDING',
        },
        include: {
          assignedToEmployee: { select: { id: true, firstName: true, lastName: true, position: true } },
          createdByUser: { select: { id: true, name: true, email: true } },
        },
      });
      createdTasks.push(created);
    }

    return NextResponse.json({ ok: true, createdCount: createdTasks.length, tasks: createdTasks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Chyba při zpracování AI úkolů.' }, { status: 500 });
  }
}
