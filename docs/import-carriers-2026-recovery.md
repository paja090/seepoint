# Obnova po importu databĂˇze nosiÄŤĹŻ 2026

Importer nevytvĂˇĹ™Ă­ automatickĂ˝ destruktivnĂ­ rollback. KaĹľdĂ˝ aplikovanĂ˝ scope bÄ›ĹľĂ­ v samostatnĂ© databĂˇzovĂ© transakci a zapisuje `ImportBatch` s hashem XLSX, hashem plĂˇnu, scope, referenÄŤnĂ­m datem a vĂ˝slednĂ˝mi poÄŤty.

## PĹ™ed aplikacĂ­

1. VytvoĹ™it a ovÄ›Ĺ™it obnovitelnou zĂˇlohu databĂˇze.
2. Uchovat pouĹľitĂ˝ safe-plan, zdrojovĂ© XLSX a dry-run reporty.
3. Zkontrolovat, Ĺľe `PHOTO_OPERATIONS = 0`.
4. PouĹľĂ­t `--confirm-backup` a produkÄŤnĂ­ potvrzenĂ­ pouze po ruÄŤnĂ­ kontrole.

## Obnova

1. Zastavit dalĹˇĂ­ importy a ruÄŤnĂ­ zmÄ›ny.
2. Identifikovat dotÄŤenĂ˝ `ImportBatch` a jeho `planHash`.
3. Porovnat ÄŤas importu s pozdÄ›jĹˇĂ­mi ruÄŤnĂ­mi zmÄ›nami. Pokud existujĂ­, neprovĂˇdÄ›t hromadnĂ© mazĂˇnĂ­ podle `importBatchId`.
4. Obnovit databĂˇzi z potvrzenĂ© zĂˇlohy do oddÄ›lenĂ©ho prostĹ™edĂ­.
5. Porovnat dotÄŤenĂ© nosiÄŤe, plochy, obsazenosti a ceny podle stabilnĂ­ch `sourceKey`.
6. PĹ™enĂ©st zpÄ›t pouze ovÄ›Ĺ™enĂ© rozdĂ­ly, nebo po schvĂˇlenĂ© odstĂˇvce obnovit celou databĂˇzi.
7. SamostatnÄ› ovÄ›Ĺ™it ID fotografiĂ­, jejich vazby a poÄŤty; importer fotografie nemÄ›nĂ­.

Tento postup zĂˇmÄ›rnÄ› upĹ™ednostĹuje obnovu ze zĂˇlohy a ruÄŤnĂ­ porovnĂˇnĂ­ pĹ™ed automatickĂ˝m mazĂˇnĂ­m, kterĂ© by mohlo odstranit navazujĂ­cĂ­ ruÄŤnĂ­ prĂˇci.
