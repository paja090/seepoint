# Mobilní realizace – třetí etapa

Moje trasa ukazuje ve výchozím pohledu jednu aktuální zastávku každého výjezdu. Přednost má rozpracovaná práce, dále původní pořadí nedokončených bodů, nakonec problémové body. Po dokončení se výběr automaticky posune. Problémy zůstávají označené v počítadle i přehledu. Hotové a zrušené body se nevybírají jako další.

Mapa a ostatní zastávky se vykreslí až po rozbalení. Podrobné časy zůstávají v rozbalovací části. U aktuálního bodu se focení a potvrzení dokončení nabízí po zahájení. Původní formuláře, GPS, potvrzovací gesto, fotodokumentace, skutečné množství a předání materiálu používají dosavadní API a validace.

Klíč potvrzovacího požadavku se po chybě spojení nebo obnovení dat nezahazuje. Opakování stejného obsahu tak využije serverovou idempotenci. Nejde o perzistentní offline frontu fotografií; upload se v této etapě nemění.

Ověření: jednotkové testy výběru bodu a mobilní prohlížečový test se simulovanými daty, včetně chybného obnovení, opakování potvrzení, následující zastávky, problémů a údajů o předání materiálu. Žádná migrace ani zápis testovacích dat do skutečné databáze. Pouze preview.
