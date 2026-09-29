# Severka Logistika – požadavky na Dispečink v cloudu a možnosti AI
Verze: 1.0 | Poslední aktualizace: 2026-05-12 | Zdroj: relace 1

## 1. Manažerské shrnutí
- Oficiálním spouštěčem projektu je konec nájmu serverovny na konci prosince příštího roku; z pohledu dispečinku je hlavním problémem nestabilita a pomalost aplikace v pondělní ranní špičce.
- Dispečink podporuje provoz 24/7 pro přibližně 150 dispečerů ve třech depech; spolu se sklady a obchodem jde asi o 200 uživatelů. Denně se řeší cca 2 500 zásilek, v pondělí až cca 3 800. Aplikace je napojena na telematiku a ERP Helios.
- Úspěch pro dispečink znamená několik měsíců špiček bez neplánovaného výpadku, výrazně rychlejší načtení tabule a odstranění potřeby papírových nebo excelových záložních seznamů.
- Pouhý rychlý přesun bez řešení provozních bolestí by dispečink neakceptoval; první fáze musí zahrnout stabilitu ve špičce a bezpečný přesun bez náhlé změny práce.
- Rozhodovat budou hlavně CEO a CIO; vedoucí dispečinku má praktické veto na změny ohrožující směny.
- Priorita z pohledu dispečinku je stabilita a bezpečný odchod ze serverovny, poté řidičské potvrzení doručení a důkazy o doručení, až poté AI. Dispečink obsahuje osobní údaje příjemců a řidičů včetně polohy; GDPR, audit změn a farmaceutické teplotní logy jsou relevantní.
- Nejhorší dopad výpadku je ztráta rozpracovaných změn; denní neplánovaný výpadek je snesitelný maximálně cca 15 minut a tolerovaná ztráta dat je maximálně cca 5 minut.
- Záznamy se kvůli účetnictví a sporům drží 10 let; pro běžnou dispečerskou práci má být prakticky online posledních 13 měsíců.

## 2. Kontext a cíle
- Motivace: opuštění vlastní serverovny do konce příštího roku a odstranění nestability nebo pomalosti Dispečinku hlavně v pondělní ranní špičce.
- Měřitelný provozní úspěch pro dispečink: několik měsíců pondělních špiček bez neplánovaného výpadku a bez potřeby papírových záložních seznamů.
- Rozhodování: hlavně CEO a CIO; vedoucí dispečinku zastupuje provoz a má praktické veto na změny ohrožující směny. Pilot v Ostravě by za provoz potvrzovala Jana Horáková společně s vedením ostravského depa.
- Rozpočet: respondentka zná jen orientační hranici „ne víc než nový kamion ročně“.

## 3. Tvar řešení a rozsah
| Tvar řešení | Relevance | Priorita | Fáze | Poznámka |
|---|---|---|---|---|
| Rychlý přesun ze serverovny | ano | 1 | první fáze / Ověřit | Prioritní spolu se stabilitou; samotný přesun bez řešení výpadků nestačí. |
| Modernizace aplikace | ano | 1 | první fáze / Ověřit | Z pohledu dispečinku znamená hlavně stabilitu, výkon ve špičce a odstranění papírových obcházek. |
| Nahrazení části nebo celé aplikace | možná | Ověřit | Ověřit | Zatím není známo, zda je přijatelné. |
| Cloudová provozní základna | možná | Ověřit | Ověřit | Produkční cloudová základna zatím není potvrzena. |
| AI pomoc dispečerům | možná | 3 | později / Ověřit | Užitečná je příprava zákaznické odpovědi se schválením dispečerem a shrnutí předání směny bez práce navíc. Návrhy tras nejsou v první vlně. |
| Zpracování CMR / dodacích listů | možná | Ověřit s účtárnou | Ověřit | Není oblast vedoucí dispečinku; řeší účtárna, paní Dvořáková. |
| Pozdější řidičské a mobilní scénáře | ano | 2 | později / Ověřit | Největší hodnota: potvrzení doručení a fotografie důkazu o doručení; incidenty až následně. Dnes řidiči používají vlastní telefony a WhatsApp skupiny podle depa, bez jednotných firemních účtů. |

Co je mimo první fázi: složité AI plánování tras, automatické rozhodování o trasách a kompletní předělání fakturace.

## 4. Uživatelé a role
| Role | Interní/externí | Organizační jednotka | Počet řádově | Co potřebuje dělat |
|---|---|---|---|---|
| Dispečeři | interní | Praha, Brno, Ostrava | cca 150; špička cca 110 online | Používat Dispečink ve směnném provozu 24/7, plánovat a řešit zakázky. |
| Vedoucí směn | interní | dispečink | Ověřit | Pracovat s Dispečinkem, řídit předání směny a jako první řešit incidenty mimo pracovní dobu. |
| Sklady | interní | sklady | cca 40 | Závisí na stavu zakázek v Dispečinku. |
| Obchod / zákaznický servis | interní | obchod / zákaznický servis | cca 12 z obchodu; zákaznický servis ověřit | Sledují stav zakázek a odpovídají na zákaznické dotazy. |
| Vedoucí dispečinku | interní | dispečink / provoz | 1+ | Reprezentovat provozní priority a vetovat změny ohrožující směny. |
| Vedení depa Ostrava | interní | depo Ostrava | Ověřit | Spolupotvrdit provozní pilot v Ostravě. |
| Řidiči | interní / subdodavatelé také ověřit | provoz | cca 600 vozidel / počet osob ověřit | Dnes vlastní telefony a WhatsApp skupiny podle depa; v budoucnu potvrzení doručení, fotografie důkazu o doručení, později incidenty. |
| Účtárna | interní | finance / účtárna | Ověřit | Řeší CMR a dodací listy; kontaktní osoba paní Dvořáková. |
| Interní vývojový tým | interní | IT / vývoj | 3 | Rozvíjet aplikaci; přesná odpovědnost ověřit. |
| Externí vývojový partner DevSoft | externí | dodavatel | Ověřit | Dělá změny Dispečinku; nasazení probíhá asi jednou měsíčně typicky v sobotu večer. |

## 5. Klíčové scénáře použití
| ID | Název | Aktér | Spouštěč | Průběh | Výsledek | Priorita | Příklady vstupů nebo dotazů |
|---|---|---|---|---|---|---|---|
| UC-01 | Stabilní odbavení pondělní špičky | dispečer | pondělí 6–10 | Přibližně 110 online dispečerů plánuje a upravuje zakázky v Dispečinku bez pádu aplikace, výrazné pomalosti a papírové obcházky. | Zakázky jsou odbavené bez neplánovaného výpadku a bez ztráty rozpracovaného plánování. | vysoká | až cca 3 800 pondělních zásilek, rozpracované plánování |
| UC-02 | Mobilní potvrzení doručení | řidič, dispečer | dokončení doručení | Řidič dodá potvrzení doručení a fotografii důkazu o doručení digitálním kanálem místo osobního telefonu nebo WhatsApp skupiny. | Dispečink má dohledatelný důkaz o doručení. | střední | fotografie důkazu o doručení |
| UC-03 | Předání směny | dispečer, vedoucí směny | konec směny | Odcházející směna předá zpožděné vozy, neuzavřené zakázky a sliby dané zákazníkům. | Nová směna má jasný přehled otevřených rizik a závazků. | vysoká | zpožděné vozy, neuzavřené zakázky, zákaznické sliby |
| UC-04 | Odpověď na dotaz zákazníka | dispečer, zákaznický servis | zákazník se ptá na stav zásilky nebo čas doručení | Uživatel ověří stav a polohu v Dispečinku, případně volá řidiči, a může využít připravený návrh odpovědi. | Zákazník dostane konzistentní odpověď; dispečer ji před odesláním schvaluje. | střední | „kde je zásilka“, „kdy dorazí“ |
| UC-05 | Shrnutí předání směny | dispečer, vedoucí směny | konec směny | Systém připraví shrnutí otevřených problémů, pokud to nepřidá práci navíc. | Nová směna získá rychlý přehled; lidské předání zůstává zachováno. | střední | zpožděné vozy, neuzavřené zakázky, sliby zákazníkům |

## 6. Funkční požadavky
| ID | Oblast | Požadavek | Priorita | Stav | Zdroj |
|---|---|---|---|---|---|
| FR-001 | migrace | Systém musí umožnit odchod od provozu v současné serverovně v termínu daném koncem nájmu. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-002 | dispečerské workflow | Systém musí chránit rozpracované plánování při přesunu nebo změně řešení. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-003 | dispečerské workflow | Systém má snížit nebo odstranit potřebu papírových záložních seznamů pro pondělní špičky. | Má | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-004 | migrace | První fáze nesmí být jen technický přesun, který zachová neřešené pondělní výpadky a pomalost. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-005 | řidičské a mobilní scénáře | Řidičské mobilní scénáře mají být posouzeny jako další priorita po stabilitě a odchodu ze serverovny. | Má | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-006 | řidičské a mobilní scénáře | Řidič má mít v budoucím mobilním scénáři možnost dodat potvrzení doručení a fotografii důkazu o doručení. | Má | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-007 | řidičské a mobilní scénáře | Hlášení incidentů od řidiče má být posouzeno jako navazující mobilní scénář po potvrzení doručení. | Může | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-008 | dispečerské workflow | Systém musí podporovat předání směny se zpožděnými vozy, neuzavřenými zakázkami a sliby danými zákazníkům. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-009 | data a reporting | Systém má poskytovat stav zakázek pro sklady, obchod, zákaznický servis a management reporty. | Má | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-010 | integrace ERP | Po dokončení přepravy musí zakázka pokračovat do ERP pro fakturaci. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-011 | dispečerské workflow | Systém má snížit ruční přepisování stavu zakázek do e-mailů zákazníkům a poznámek mezi Dispečinkem, telefonem a Excelem. | Má | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-012 | dostupnost provozních informací | Systém má pomoci rychle rozpoznat urgentní problém podle zpoždění auta, volání řidiče nebo zákazníka a GPS odchylky od plánu. | Má | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-013 | dispečerské workflow | Uživatel má mít podporu pro konzistentní odpověď zákazníkovi na stav zásilky nebo čas doručení založenou na stavu zakázky a poloze; dispečer odpověď před odesláním schvaluje. | Může | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-014 | integrace telematiky | Systém musí poskytovat GPS polohu dostatečně rychle pro okamžité řešení vozu mimo plán. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-015 | integrace ERP | Systém musí podporovat noční předávání hotových přeprav do ERP pro fakturaci; chybové stavy má upřesnit IT nebo účtárna. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-016 | migrace | Pilot bezpečného přechodu má být posouzen pro depo Ostrava jako menší a klidnější provoz. | Má | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-017 | AI asistence | Systém může připravit shrnutí předání směny, pokud to nepřidá dispečerům práci navíc. | Může | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-018 | AI asistence | Systém nemá v první vlně poskytovat složité AI plánování nebo automatické návrhy tras jako náhradu rozhodnutí dispečera. | Nebude | Potvrzeno | relace 1, vedoucí dispečinku |
| FR-019 | data a reporting | Systém musí uchovávat záznamy pro účetnictví a spory 10 let a pro dispečery prakticky online zpřístupnit posledních 13 měsíců. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |

## 7. Aplikace, data a integrace
Stávající Dispečink je interně vyvinutá webová aplikace na .NET Framework 4.8 a Windows služba. Běží na dvou on-premises virtuálních serverech Windows Server 2016, používá SQL Server 2016 o velikosti přibližně 400 GB a integruje se s telematikou a ERP Helios. Dispečer plánuje zakázku v Dispečinku, sleduje GPS, změny řeší telefonem nebo e-mailem a po dokončení jde zakázka do ERP na fakturaci. Časté ruční přepisy jsou stav zakázky do e-mailů zákazníkům a poznámky mezi Dispečinkem, telefonem a Excelem. Denní objem je zhruba 2 500 zásilek, v pondělí až kolem 3 800. GPS je potřeba prakticky hned; výpadek telematiky znamená volání řidičům a zpomalení práce. Hotové přepravy se do ERP posílají jednou za noc; detaily chyb ERP má ověřit IT nebo účtárna. Záznamy se drží 10 let kvůli účetnictví a sporům; dispečerům stačí prakticky online posledních 13 měsíců. Datový růst, detail reportingu a technická frekvence integrací je nutné ověřit. Z byznys pohledu je nejcitlivější ztráta rozpracovaného plánování.

## 8. Bezpečnost, ochrana dat a regulace
| ID | Požadavek | Důvod / regulace | Priorita | Stav | Zdroj |
|---|---|---|---|---|---|
| SEC-001 | Dispečink musí být posuzován jako systém obsahující osobní údaje příjemců, adresy, telefony, údaje o řidičích a polohu. | GDPR a ochrana provozních dat. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| SEC-002 | Ověřit, zda se na firmu vztahuje NIS2 nebo jiná regulace. | Regulatorní dopad na návrh a provoz. | Musí | Ověřit | vstupní kontext |
| SEC-003 | Ověřit vhodnost používání osobních telefonů a WhatsApp skupin pro důkazy o doručení. | Ochrana dat, dohledatelnost a firemní kontrola komunikace. | Má | Ověřit | relace 1, vedoucí dispečinku |
| SEC-004 | Systém musí podporovat dohledatelnost změn u zásilek zejména pro farmaceutické přepravy. | Farmacie vyžaduje teplotní log a audit toho, kdo co u zásilky změnil. | Musí | Potvrzeno | relace 1, vedoucí dispečinku |
| SEC-005 | ADR přepravy musí být zohledněny jako citlivější provozní scénář, i když tvoří menšinu zásilek. | ADR je odhadem cca 5 % zásilek a může mít zvláštní požadavky na evidenci. | Má | Potvrzeno | relace 1, vedoucí dispečinku |
| SEC-006 | Ověřit schvalování AI nad provozními a osobními daty s CIO, právníkem nebo bezpečností. | Riziko použití AI nad citlivými provozními a osobními daty. | Musí | Ověřit | relace 1, vedoucí dispečinku |

## 9. Nefunkční požadavky
| ID | Kategorie | Požadavek | Cílová hodnota | Stav | Zdroj |
|---|---|---|---|---|---|
| NFR-001 | dostupnost | Systém musí podporovat provoz dispečinku v režimu 24/7. | 24/7; směny 6–14, 14–22, 22–6 | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-002 | obnova po havárii | Systém má minimalizovat ztrátu rozpracovaného plánování po havárii. | maximálně cca 5 minut ztráty dat | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-003 | dostupnost | Pondělní ranní špičky musí probíhat bez neplánovaných výpadků. | několik měsíců pondělních špiček bez neplánovaného výpadku | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-004 | výkon | Systém musí být použitelný v pondělní ranní špičce bez výrazné pomalosti, která brání odbavení provozu. | cca 110 současně online dispečerů a až cca 3 800 zásilek v pondělí; tabule má být výrazně rychlejší | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-005 | přepnutí/cutover | Přesun do nového prostředí nesmí vyžadovat náhlou změnu základního způsobu práce dispečerů ze dne na den. | postupný nebo provozně bezpečný přechod; detail ověřit | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-006 | dostupnost | Náhradní postup přes Excel a telefony nesmí být hlavní provozní opora pro delší výpadek. | ruční fallback je prakticky omezený na cca 1 hodinu | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-007 | dostupnost | Neplánovaný denní výpadek mimo pondělní špičku musí být velmi krátký. | maximálně cca 15 minut přes den | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-008 | podpora | Plánovaná údržba má být směřována do nočního okna po předchozí domluvě. | mezi 22–4 až cca 2 hodiny | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-009 | přepnutí/cutover | Bezpečný přechod má zvážit dočasný paralelní provoz. | délku a technický detail má určit IT | Potvrzeno | relace 1, vedoucí dispečinku |
| NFR-010 | offline | Mobilní scénáře pro řidiče musí zohlednit slabý signál nebo offline práci. | konkrétní místa a délku offline režimu ověřit s řidiči/depy | Potvrzeno | relace 1, vedoucí dispečinku |

## 10. Omezení a stávající IT prostředí
| ID | Omezení / fakt | Dopad | Stav | Zdroj |
|---|---|---|---|---|
| CON-001 | Aplikace Dispečink je .NET Framework 4.8 webová aplikace a Windows služba. | Ovlivní migrační a modernizační možnosti. | Předpoklad | vstupní kontext |
| CON-002 | Provoz dnes běží na Windows Server 2016 ve vlastní serverovně. | Časový tlak a omezení stávající platformy. | Předpoklad | vstupní kontext |
| CON-003 | Databáze SQL Server 2016 má přibližně 400 GB. | Ovlivní migraci, výkon, obnovu a náklady. | Předpoklad | vstupní kontext |
| CON-004 | Firma má pouze zkušební cloudové prostředí, nikoli hotovou produkční cloudovou základnu. | Je nutné ověřit provozní připravenost cloudu. | Předpoklad | vstupní kontext |
| CON-005 | Kancelářští pracovníci mají Microsoft 365 E3; řidiči dnes nemají jednotné firemní účty a používají převážně vlastní telefony. | Ovlivní identity a možné řidičské scénáře. | Potvrzeno | relace 1, vedoucí dispečinku |
| CON-006 | Interní vývojový tým má 3 vývojáře a využívá externího vývojového partnera. | Ovlivní provozní model a změnovou kapacitu. | Předpoklad | vstupní kontext |
| CON-007 | Důkazy o doručení se dnes částečně řeší přes osobní telefony a WhatsApp skupiny podle depa. | Ovlivní mobilní scénáře, bezpečnost a dohledatelnost. | Potvrzeno | relace 1, vedoucí dispečinku |
| CON-008 | Některé sklady a trasy mají slabý signál; offline nebo slabé připojení je nutné posoudit. | Ovlivní mobilní návrh pro řidiče a důkazy o doručení. | Potvrzeno | relace 1, vedoucí dispečinku |
| CON-009 | Severka využívá i subdodavatele/dopravce. | Ovlivní identity, přístupy a mobilní proces mimo interní řidiče. | Potvrzeno | relace 1, vedoucí dispečinku |

## 11. Provoz a životní cyklus řešení
Směny dispečinku běží 6–14, 14–22 a 22–6. Náhradní postup přes Excel a telefony se po cca hodině stává chaotickým. Mimo pracovní dobu incident nejdřív řeší vedoucí směny a volá interní IT; v IT je jen jeden člověk s hlubokou znalostí aplikace. Změny dělá partner DevSoft, nasazení probíhá asi jednou měsíčně typicky v sobotu večer. Monitoring, detailní incident management, školení a náklady zatím nejsou známy.

## 12. Klíčové faktory pro návrh architektury
| Faktor | Zjištění | Proč je důležitý pro návrh | Jistota | Odkaz |
|---|---|---|---|---|
| 1. Byznys výsledek, vlastník a tlak konce nájmu serverovny | Známý je tlak konce nájmu, provozní úspěch a rozhodování hlavně CEO/CIO; vedoucí dispečinku má praktické veto nad změnami ohrožujícími směny. | Určuje priority, termín a úspěch projektu. | střední | FR-001, FR-003, FR-004, NFR-003, OQ-001 |
| 2. Tvar nebo kombinace tvarů řešení a jejich pořadí | Z pohledu dispečinku: 1) stabilita a odchod ze serverovny, 2) řidičské mobilní scénáře, 3) AI; CMR/dodací listy patří účtárně. | Rozlišuje přesun, modernizaci, náhradu, cloudovou základnu a AI. | střední | FR-004, FR-005, OQ-002 |
| 3. Provoz 24/7 a maximální tolerovaný výpadek | Směny jsou 6–14, 14–22 a 22–6. V pondělí 6–10 je špička cca 110 online dispečerů; denní neplánovaný výpadek je snesitelný maximálně cca 15 minut. | Určuje dostupnost a přechodový plán. | vysoká | NFR-001, NFR-003, NFR-007 |
| 4. Cíle obnovy a tolerovaná ztráta dat | Nejhorší je ztráta rozpracovaných změn; tolerovaná ztráta dat je maximálně cca 5 minut. | Určuje obnovu po havárii a ochranu dat. | střední | NFR-002, OQ-004 |
| 5. Kritické dispečerské workflow a špičkové zatížení | Kritická je pondělní špička až cca 3 800 zásilek, předání směny, tok objednávka → plánování → GPS/telefon/e-mail → ERP fakturace a zákaznické dotazy. | Určuje funkční priority a výkon. | střední | FR-002, FR-008, FR-010, FR-011, FR-012, FR-013, NFR-004, OQ-005 |
| 6. Současná architektura aplikace, závislosti a stavovost | Známa platforma; závislosti a stavovost neznámé. | Určuje proveditelnost migrace a modernizace. | nízká | CON-001, OQ-006 |
| 7. SQL datový profil: velikost, růst, funkce, retence, reporting | Známá velikost cca 400 GB, cca 2 500 zásilek denně, pondělí až cca 3 800, retence 10 let a online potřeba 13 měsíců. Růst a SQL funkce neznámé. | Určuje datovou migraci, výkon a retenci. | střední | CON-003, FR-019, OQ-007 |
| 8. Vzor integrací telematiky a ERP: frekvence, vlastnictví, selhání | GPS je potřeba prakticky hned; při výpadku telematiky se volá řidičům. Hotové přepravy se do ERP posílají jednou za noc pro fakturaci; detaily chyb ERP neznámé. | Integrace mohou určovat kritičnost a návrh přechodu. | střední | FR-014, FR-015, OQ-008 |
| 9. Omezení migrace, přepnutí/cutoveru a souběhu prostředí | Přesun musí být bezpečný, bez náhlé změny práce; vhodný pilot je Ostrava a paralelní provoz dává smysl aspoň po určitou dobu. Rollback a detail souběhu neznámé. | Určuje bezpečný přechod a rollback. | střední | FR-016, NFR-005, NFR-009, OQ-009 |
| 10. Bezpečnostní a regulatorní základ: zákaznická data, ADR, možná NIS2, audit | Známé jsou osobní údaje příjemců a řidičů včetně polohy, ADR cca 5 %, farmaceutický teplotní log a potřeba auditu změn. NIS2 a AI schvalování neznámé. | Určuje bezpečnost, audit a schvalování. | střední | SEC-001, SEC-002, SEC-003, SEC-004, SEC-005, SEC-006, OQ-010 |
| 11. Identity a přístupy pro dispečery, IT, partnera a případně řidiče | Vedle cca 150 dispečerů existuje asi 40 skladových a 12 obchodních uživatelů. Řidiči nemají jednotné firemní účty; subdodavatelé jsou také relevantní. | Určuje přihlašování, správu přístupů a audit. | nízká | CON-005, CON-009, OQ-011 |
| 12. Provozní model: interní tým, partner, support, monitoring, proces vydávání verzí | Mimo pracovní dobu eskaluje vedoucí směny na interní IT; jen jeden interní člověk zná aplikaci do hloubky. DevSoft mění aplikaci asi měsíčně, typicky sobota večer. | Určuje provozovatelnost a podporu. | střední | CON-006, OQ-012 |
| 13. Cloudová základna, konektivita a governance prostředí | Produkční základna není potvrzena. | Určuje připravenost na kritický systém. | nízká | CON-004, OQ-013 |
| 14. AI scénáře, hodnota, riziko a lidská kontrola | Užitečný je návrh odpovědi zákazníkovi se schválením dispečerem a shrnutí předání směny bez práce navíc. Návrhy tras nejsou v první vlně. | Určuje, zda a jak AI patří do rozsahu. | střední | FR-013, FR-017, FR-018, SEC-006, OQ-014 |
| 15. Řidičské, mobilní a offline potřeby včetně účtů a zařízení | Prioritou je potvrzení doručení a fotografie důkazu; řidiči používají vlastní telefony a WhatsApp, nemají jednotné účty. Offline/slabý signál a subdodavatelé vyžadují ověření. | Ovlivní identity, zařízení a budoucí kanály. | střední | CON-005, CON-007, CON-008, CON-009, FR-005, FR-006, FR-007, NFR-010, OQ-015 |
| 16. Pilotní rozsah, kritéria úspěchu, rozpočtový rámec a rozhodování | Pilot Ostrava by za provoz potvrzovala Jana Horáková s vedením depa; finálně rozhodují CEO a CIO. Kritéria: nespadne ve špičce, rychlejší tabule, bez papíru/Excelu. | Určuje první ověřitelný krok a řízení investice. | střední | FR-016, NFR-004, OQ-016 |

## 13. Předpoklady a rizika
| ID | Předpoklad nebo riziko | Dopad | Navržené ověření / mitigace |
|---|---|---|---|
| RISK-001 | Nejasný význam slov „cloud“ a „AI“ může vést k rozdílným očekáváním. | Riziko špatného rozsahu a priorit. | Ověřit tvar řešení a priority v oblasti B. |
| RISK-002 | Konec nájmu serverovny vytváří pevný termín bez potvrzené cloudové produkční základny. | Riziko časového tlaku na migraci a provozní připravenost. | Ověřit termíny, rozhodování a připravenost IT. |
| RISK-003 | Změna Dispečinku může ohrozit rozpracované plánování nebo pondělní ranní špičku. | Přímý dopad na schopnost odbavit zakázky; březnový výpadek cca 3,5 hodiny způsobil asi 40 zpožděných dodávek a jednu smluvní pokutu. | Ověřit kritické workflow, plán přechodu a ochranu rozpracovaných změn. |
| RISK-004 | Projekt by mohl být řízen jako rychlý přesun bez odstranění hlavních provozních bolestí. | Provoz by takový výsledek považoval za neúspěch a vedoucí dispečinku by ho rozporovala. | V rozsahu první fáze explicitně potvrdit stabilitu a výkon pondělní špičky. |
| RISK-005 | Důkazy o doručení přes osobní telefony a WhatsApp mohou být špatně dohledatelné nebo nevhodné pro citlivá data. | Riziko ztráty informací, horší auditovatelnosti a bezpečnostních problémů. | Ověřit s bezpečností, DPO a provozem řidičů. |
| RISK-006 | Znalost aplikace je interně koncentrovaná u jednoho člověka v IT. | Riziko podpory, eskalací a změn mimo pracovní dobu. | Ověřit provozní model s CIO/IT a DevSoftem. |

## 14. Registr otevřených otázek
| ID | Oblast | Otázka | Proč je důležitá | Kdo má odpovědět | Priorita | Stav | Odpověď |
|---|---|---|---|---|---|---|---|
| OQ-001 | Kontext a cíle | Kdo je sponzor, byznys vlastník a jaký měřitelný výsledek znamená úspěch? | Určuje řízení projektu a priority. | vedení / byznys vlastník | vysoká | Částečně zodpovězeno v relaci 1 | Rozhodovat budou hlavně CEO a CIO; dispečink zastupuje Jana Horáková. Pro dispečink je úspěch několik měsíců pondělních špiček bez neplánovaného výpadku a bez papírových záložních seznamů. |
| OQ-002 | Tvar řešení | Jaké pořadí mají přesun, modernizace, náhrada, cloudová základna, AI, dokumenty a řidičské scénáře? | Určuje rozsah první fáze. | byznys vlastník / CIO | vysoká | Částečně zodpovězeno v relaci 1 | Z pohledu dispečinku: 1) stabilita a odchod ze serverovny, 2) řidičské mobilní scénáře, 3) AI. CMR a dodací listy ověřit s účtárnou, paní Dvořákovou. |
| OQ-003 | Dostupnost | Jaký neplánovaný výpadek je snesitelný? | Určuje požadavky na dostupnost. | byznys vlastník / IT | vysoká | Částečně zodpovězeno v relaci 1 | V pondělí 6–10 se očekává žádný neplánovaný výpadek; přes den mimo tuto špičku maximálně cca 15 minut. |
| OQ-004 | Obnova | Jaká ztráta dat je přijatelná po havárii? | Určuje cíle obnovy. | byznys vlastník / IT | vysoká | Částečně zodpovězeno v relaci 1 | Ztráta rozpracovaného plánování je nejhorší dopad; pokud vůbec, maximálně několik minut, přibližně do 5 minut. Ověřit technicky s IT. |
| OQ-005 | Workflow | Které dispečerské kroky a špičky jsou kritické? | Určuje funkční priority a výkon. | vedoucí dispečinku | vysoká | Částečně zodpovězeno v relaci 1 | Kritická je pondělní špička, předání směny, ruční odpovědi zákazníkům a sledování zpoždění/GPS odchylek. Složitější přeprava: objednávka, plánování v Dispečinku, GPS, změny telefon/e-mail, po dokončení ERP fakturace. |
| OQ-006 | Aplikace | Jaké jsou závislosti, stavovost a technická omezení Dispečinku? | Určuje proveditelnost přesunu. | vývojový partner / IT | vysoká | Otevřeno | |
| OQ-007 | Data | Jaký je růst, retence, reporting a specifické SQL funkce? | Určuje datovou migraci a provoz. | IT / vlastník dat | vysoká | Částečně zodpovězeno v relaci 1 | Cca 2 500 zásilek denně, v pondělí až cca 3 800. Retence 10 let kvůli účetnictví/sporům; dispečerům online posledních 13 měsíců. Růst a SQL funkce otevřené pro IT. |
| OQ-008 | Integrace | Jak funguje telematika a ERP z hlediska frekvence, vlastnictví a dopadu výpadků? | Integrace jsou kritické pro provoz. | dispečink / IT / dodavatelé | vysoká | Částečně zodpovězeno v relaci 1 | GPS je potřeba prakticky hned; výpadek telematiky vede k volání řidičům. Hotové přepravy se do ERP posílají jednou za noc; detaily chyb ERP ověřit s IT nebo účtárnou. |
| OQ-009 | Migrace | Jaký přechod, souběh a rollback je přijatelný? | Určuje plán bezpečného nasazení. | byznys vlastník / IT | vysoká | Částečně zodpovězeno v relaci 1 | Přesun musí být bezpečný a nesmí změnit práci ze dne na den. Vhodný pilot je Ostrava a paralelní provoz dává smysl po určitou dobu; délka souběhu a rollback otevřené pro IT. |
| OQ-010 | Bezpečnost | Jaké citlivé údaje, ADR, audit a regulace platí? | Určuje bezpečnostní návrh. | bezpečnost / DPO / byznys | vysoká | Částečně zodpovězeno v relaci 1 | Dispečink obsahuje údaje o příjemcích, adresy, telefony, údaje o řidičích a polohu. ADR je odhadem cca 5 % zásilek. Farmacie vyžaduje teplotní log a audit změn. NIS2 otevřené pro CIO/právníka/bezpečnost. |
| OQ-011 | Identity | Jak se řeší přístupy dispečerů, IT, partnera a případně řidičů? | Určuje správu identit a audit. | IT / bezpečnost | vysoká | Částečně zodpovězeno v relaci 1 | Celkový počet uživatelů Dispečinku je cca 200. Řidiči nemají jednotné firemní účty a používají vlastní telefony; subdodavatelé také vstupují do procesu. Rozdíly práv otevřené pro IT. |
| OQ-012 | Provoz | Kdo bude řešení provozovat, podporovat a měnit? | Určuje provozní model. | CIO / IT / partner | vysoká | Částečně zodpovězeno v relaci 1 | Mimo pracovní dobu první řeší vedoucí směny a volá interní IT; v IT je jeden člověk s hlubokou znalostí aplikace. Změny dělá DevSoft asi měsíčně, typicky sobota večer. |
| OQ-013 | Cloudová základna | Jaká cloudová prostředí, konektivita, governance, monitoring a zálohy jsou k dispozici nebo nutné? | Určuje připravenost prostředí. | CIO / IT | vysoká | Otevřeno | |
| OQ-014 | AI | Které AI scénáře mají hodnotu, jaké chyby jsou nepřijatelné a kde musí rozhodovat člověk? | Určuje bezpečný rozsah AI. | dispečink / bezpečnost / vedení | střední | Částečně zodpovězeno v relaci 1 | Hodnotné jsou návrh odpovědi zákazníkovi se schválením dispečerem a shrnutí předání směny bez práce navíc. Návrhy tras nejsou v první vlně. Schválení AI nad daty musí říct CIO/právník/bezpečnost. |
| OQ-015 | Řidiči | Jaké jsou budoucí mobilní a offline potřeby řidičů, zařízení a účtů? | Ovlivní budoucí kanály a identitu. | provoz / zástupce řidičů / CIO | střední | Částečně zodpovězeno v relaci 1 | Prioritní jsou potvrzení doručení a fotografie důkazu; řidiči používají vlastní telefony a WhatsApp podle depa, nemají jednotné firemní účty. Offline/slabý signál a subdodavatelé otevření pro ověření. |
| OQ-016 | Pilot | Jaký pilot, kritéria úspěchu, rozpočet a rozhodovací proces dávají smysl? | Určuje první ověřitelný krok. | vedení / byznys vlastník / CIO | vysoká | Částečně zodpovězeno v relaci 1 | Provozní návrh pilotu je Ostrava. Za provoz potvrzuje Jana Horáková s vedením ostravského depa; finálně CEO/CIO. Kritéria: nespadne ve špičce, rychlejší tabule, bez papíru/Excelu. |

## 15. Slovník
- **Dispečink:** interní aplikace pro podporu dispečerského provozu Severky.
- **ERP Helios:** podnikový systém napojený na Dispečink; konkrétní data ověřit.
- **Telematika:** systém poskytující data z GPS jednotek vozidel; detaily ověřit.
- **CMR:** přepravní dokument pro silniční nákladní dopravu.
- **ADR:** režim pro přepravu nebezpečných věcí; rozsah v Severce ověřit.
- **Směna:** dispečerská směna 6–14, 14–22 nebo 22–6.
- **Přepnutí / cutover:** okamžik přechodu z původního řešení na nové.
- **Fallback / náhradní postup:** ruční nebo alternativní postup při výpadku systému; dnes Excel a telefony, prakticky cca do 1 hodiny.
- **RTO:** maximální cílová doba obnovy po výpadku.
- **RPO:** maximální cílová ztráta dat po havárii; byznys tolerance pro rozpracované plánování je cca do 5 minut.
- **AI asistence:** podpůrná funkce, která navrhuje nebo předzpracuje informace, ale rozhodnutí zůstává na člověku, pokud to proces vyžaduje.

## 16. Historie změn
| Verze | Datum | Relace | Respondent (role) | Hlavní změny |
|---|---|---|---|---|
| 1.0 | 2026-05-12 | relace 1 | Jana Horáková (vedoucí dispečinku) | Zachyceny provozní priority, kritičnost, workflow, integrace, bezpečnostní témata, mobilní výhled a pilot Ostrava. |
