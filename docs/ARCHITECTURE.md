# Architektura systému SeePoint

Tento dokument slouží jako autoritativní popis architektury, doménových hranic, zdrojů pravdy a klíčových pracovních postupů (workflows) v aplikaci SeePoint.

---

## 1. Hlavní domény a zdroje pravdy

| Doména | Popis oblasti | Prisma model (Zdroj pravdy) |
|---|---|---|
| **CRM** | Správa klientů, kontaktů, poboček, obchodních nabídek, zakázek, úkolů a komunikace. | `Client`, `ClientContact`, `ClientBranch`, `Offer`, `CrmOrder`, `CrmTask`, `ClientCommunication`, `ClientDocument` |
| **Média** | Fyzická infrastruktura nosičů a obchodovatelné reklamní plochy včetně ceníků a obsazenosti. | `AdvertisingCarrier`, `AdvertisingSurface`, `Occupancy`, `MediaPackage`, `OfferPriceRule`, `PriceListItem` |
| **Navigace** | Specializovaný modul navigačního značení, plánování tras, bodů, vizualizací a kvartální fotodokumentace. | `NavigationOffer`, `NavigationOrder`, `NavigationPoint`, `NavigationContract`, `NavigationBillingPeriod`, `NavigationDocumentationReport` |
| **Realizace** | Fyzická instalace, tisk, demontáže a průběh realizace obchodní zakázky. | `CrmRealization`, `WorkOrder`, `WorkOrderItem`, `WorkAssignment` |
| **Práce & Terén** | Operativní úkoly terénních pracovníků, výkazy práce, nákladů a vozového parku. | `WorkTask`, `WorkEntry`, `WorkExpense`, `Vehicle`, `VehicleReservation` |
| **Finance** | Interní vyúčtování pracovníků vs. klientská fakturace. | Interní: `Settlement`, `SettlementItem`, `Invoice`. Klientské: `ClientInvoice`, `ClientInvoiceItem` |
| **Zaměstnanci & RBAC** | Správa přihlašovacích účtů, zaměstnaneckých profilů, sazebních pravidel a oprávnění. | `User`, `Employee`, `EmployeeBillingProfile`, `EmployeeRate`, `CompanyRate`, `WorkOrderRate` |

---

## 2. Hlavní Workflows

### 2.1 Obchodně-realizační tok (CRM → Realizace → Práce → Vyúčtování)
1. **Klient (`Client`)** – Založení klienta nebo poptávky.
2. **Nabídka (`Offer`)** – Vytvoření nabídky v jednom ze tří typů (`STANDARD_MEDIA`, `NAVIGATION`, `CITY_GALLERY`). Vložení reklamních ploch (`AdvertisingSurface`) nebo navigačních bodů.
3. **Akceptace nabídky** – Při schválení nabídky klientem se spustí idempotentní konverze: `Offer` → `CrmOrder`.
4. **Zahájení realizace** – Z `CrmOrder` vznikají:
   - `CrmRealization` – sledování stavek podkladů, tisku a přípravy.
   - `NavigationOrder` – pokud jde o navigační nabídku.
   - `WorkOrder` – fyzická pracovní zakázka pro terénní tým (montéry).
5. **Pracovní úkol (`WorkTask`)** – `WorkOrder` se rozpadne na konkrétní `WorkTask` přiřazený montérovi.
6. **Odvedená práce (`WorkEntry`)** – Po dokončení úkolu pracovník vykáže skutečnou práci (`WorkEntry`) a přiloží výdaje (`WorkExpense`) a fotky (`Photo`).
7. **Vyúčtování pracovníka (`Settlement`)** – Schválené `WorkEntry` a `WorkExpense` se načtou do měsíčního `Settlement`, odkud pracovník generuje dodavatelskou fakturu `Invoice`.

### 2.2 Klientská fakturace (CRM / Navigace → Klientská faktura)
1. **Obchodní zakázka (`CrmOrder`)** nebo **Opakující se navigační období (`NavigationBillingPeriod`)** vygeneruje podklad pro fakturaci.
2. **Klientská faktura (`ClientInvoice`)** vzniká směrem od SeePointu ke klientovi.

---

## 3. Pravidla pro zamezení duplicit a kolizí

> [!IMPORTANT]
> V systému SeePoint platí přísná pravidla pro oddělení odpovídajících entit. Žádná nová funkce nesmí vytvářet paralelní modely.

1. **`AdvertisingSurface` vs `Occupancy`**:
   - `Occupancy` je **jediným zdrojem pravdy** obchodní obsazenosti v čase (historie, současnost i budoucnost).
   - Pole na `AdvertisingSurface` (`status`, `currentClientId`, `currentRentStart`, `currentRentEnd`) slouží výhradně jako **rychlý snapshot / cache** odvozený z nejvyšší aktivní `Occupancy` k danému datu.

2. **`ClientContract` vs `NavigationContract`**:
   - `ClientContract` = obecná rámcová nebo obchodní smlouva s klientem.
   - `NavigationContract` = provozní / nájemní smlouva vymezená pro konkrétní navigační pozice a trasy.

3. **`CrmRealization` vs `WorkOrder`**:
   - `CrmRealization` = obchodní a zákaznický stav realizace položky zakázky (schválení grafiky, tisk, kompletace).
   - `WorkOrder` = fyzická operativní pracovní zakázka pro výjezd montérů.

4. **`WorkTask` vs `WorkEntry`**:
   - `WorkTask` = plánovaný úkol (co má být uděláno).
   - `WorkEntry` = skutečně odvedená a vykázaná práce (co bylo uděláno, kým, jak dlouho/kolik kusů a za jakou sazbu).

5. **`Invoice` vs `ClientInvoice`**:
   - `Invoice` = faktura dodavatele / OSVČ pracovníka vystavená SeePointu na základě schváleného `Settlement`.
   - `ClientInvoice` = faktura vystavená SeePointem směrem ke klientovi.

---

## 4. Role a oprávnění (RBAC)

- **`ADMIN`**: Plný přístup ke všem modulům a nastavením.
- **`MANAGER`**: Řízení obchodů, schvalování výkazů práce a vyúčtování.
- **`SALES`**: Správa klientů, tvorba nabídek a zakázek.
- **`TECHNICIAN`**: Řízení realizací, kontrola kvality (QC), navigační moduly.
- **`WORKER`**: Přístup k vlastním úkolům, mobilní fotodokumentaci a výkazům práce.
- **`ACCOUNTANT`**: Správa vyúčtování, klientských faktur a financí.
- **`VIEWER`**: Náhled na data bez možnosti modifikace.
