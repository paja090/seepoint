# Audit obecného Field Planneru

Baseline 2026-09-15: npm test 725 PASS / 0 FAIL / 3 SKIP (728 testů).

- WorkOrderItem představuje položku práce, může odkazovat na nosič, plochu nebo být pouze textovou položkou. Quantity je počet kusů práce na položce, nikoli počet různých GPS. Nemá stav, servisní dobu, problém ani vlastní fotografie.
- AdvertisingSurface nemá GPS. Její poloha pochází z povinného AdvertisingCarrier. Pokud položka uvádí zároveň carrierId a surfaceId, musí plocha patřit stejnému nosiči. Nesoulad se odmítne.
- WorkTask je synchronizován z WorkAssignment po pracovnících za celý WorkOrder. Nejde o model jednotlivých pracovních míst. Rozdělit úkoly umělým násobením WorkOrder/WorkTask by rozbilo výkazy a původní sync.
- CrmRealization má vlastní stav (SCHEDULED, INSTALLATION_IN_PROGRESS, INSTALLED, PHOTOGRAPHED…), claimNote, actualDate a Photo vazbu. Není ale povinná a vyžaduje CRM zakázku. Samostatným WorkOrderům proto nelze vytvářet falešné CRM realizace. Pokud je položka explicitně propojena, realizace zůstane jediným zdrojem jejího provozního stavu.
- Photo již ukládá carrierId, surfaceId, crmRealizationId, taskId a workEntryId. Chybí přesná vazba na samostatnou WorkOrderItem. Stejný nosič může mít více různých prací, takže samotný carrierId jako doklad konkrétní práce nestačí.
- Běžné PATCH WorkOrder dnes maže a znovu vytváří všechny položky. U realizovaných/vícebodových položek je třeba zachovat identitu a upravovat je samostatně; jejich mazání nesmí odstranit historii ani doklady.
- AI Realization standardní adaptér odvozuje instalaci z CrmRealization.status a dokumentaci z Photo. claimNote/CLAIM jsou blocker. Planner nesmí nastavovat FTD, schválený WorkEntry ani obcházet tuto evaluaci.
- Stávající Field Planner načítá Navigation data bez samostatné kontroly aktivního navigation modulu; UI vždy nabízí Navigation konfiguraci. To je potřeba opravit na serveru i v UI včetně čtení starších snapshotů.

## Nejmenší potřebné rozšíření

Žádný nový databázový model. Doplnit existující WorkOrderItem o nullable executionStatus (reuse WorkOrderStatus), časy zahájení/dokončení, problém, délku práce, updatedAt a volitelnou jednoznačnou vazbu na CrmRealization. Nullable stav zachová kompatibilitu jednoduchých historických WorkOrderů. U propojené realizace se stav položky odvozuje z ní, nikoli ze druhé kopie.

Photo dostane volitelný workOrderItemId. Dokumentace konkrétní položky se nevztahuje automaticky na sousední úkol stejného nosiče. Vazby chrání historii před smazáním.

Adaptér WorkOrderItem bude emitovat samostatné identity do stávajícího enginu. Souhrnné estimatedHours WorkOrderu se při rozdělení nekopírují do každé položky; použijí se explicitní délky a tenantové defaults. Textové položky bez nosiče/plochy se nebudou vydávat za fyzické zastávky; nejasné podklady zůstanou k doplnění.

Navigace zůstanou volitelným adaptérem. Použije se současné isModuleEnabled nad skutečnou aktivní organizací. Vypnuté zdroje se nenačítají ani nevracejí a jejich přímý výběr/schválení/realizace se odmítne.

Lokální migrace je nutná pro kanonické dokončení a přesné fotografie samostatných položek. Aplikovat pouze na izolovanou testovací databázi; žádná produkční migrace ani deployment.
