# Severka Logistika – záznam discovery rozhovorů

## Relace 1 – 2026-05-12
- **Respondent:** Jana Horáková, vedoucí dispečinku, Brno
- **Délka / rozsah:** cca 45 minut; první relace se zaměřením na byznys a provozní pohled dispečinku
- **Pokryté oblasti:** úvod; A; B; C; D; E; F/G; I; J/K; L/M/O; kontrola pokrytí

### Shrnutí relace
- Respondentkou je Jana Horáková, vedoucí dispečinku v Brně; mluví za dispečink a provozní řízení, ne za IT ani finance.
- Oficiální spouštěč projektu je konec nájmu serverovny, ale pro dispečink je hlavní hodnota stabilita a výkon pondělní špičky.
- Úspěch znamená špičky bez neplánovaného výpadku, výrazně rychlejší tabuli a žádnou potřebu papírové nebo excelové zálohy.
- Rozhodují CEO a CIO; Jana Horáková má provozní veto a pilot v Ostravě by potvrzovala s vedením ostravského depa.
- Priorita je stabilita a bezpečný odchod ze serverovny, potom řidičské mobilní potvrzení doručení, až poté AI.
- Kritický provoz: směny 6–14, 14–22, 22–6; pondělí 6–10 až cca 110 online dispečerů a cca 3 800 zásilek.
- Nejhorší je ztráta rozpracovaných změn; denní výpadek max cca 15 minut, tolerovaná ztráta dat cca 5 minut, noční plánovaná údržba až cca 2 hodiny.
- Dispečink má cca 200 uživatelů včetně skladů a obchodu; obsahuje osobní údaje, polohu řidičů, ADR cca 5 % a farmaceutické teplotní logy/audit změn.
- Pilot: Ostrava, dočasný paralelní provoz k ověření s IT; kritéria jsou stabilita ve špičce, rychlejší tabule a bez papíru/Excelu.
- Další rozhovory: CIO Petr Malý, Pavel Novák z DevSoftu, Irena Dvořáková z účtárny, právní/bezpečnost, zástupce řidičů z Ostravy a subdodavatel.

### Průběh podle oblastí
#### Úvod a role respondenta
- **Otázka:** Jaká je vaše role, za jakou část organizace mluvíte a kolik času dnes máme?
  **Odpověď:** Jana Horáková vede dispečink v Severka Logistika a sedí v Brně. Mluví hlavně za dispečink a provozní řízení z pohledu lidí, kteří denně plánují a řeší zakázky. Za IT nebo finance mluvit neumí. Na rozhovor má přibližně 45 minut.

#### A – Byznys kontext a úspěch
- **Otázka:** Co spustilo téma přesunu Dispečinku právě teď, jak by dispečink poznal úspěch a co by se nesmělo stát?
  **Odpověď:** Oficiálním spouštěčem je konec nájmu serverovny na konci prosince příštího roku a tlak CIO. Z provozního pohledu je větší problém nestabilita a pomalost aplikace, hlavně v pondělí ráno při největším provozu. Úspěch by Jana Horáková poznala tak, že pondělní špičky několik měsíců proběhnou bez neplánovaného výpadku a dispečeři přestanou držet papírové záložní seznamy. Při změně se nesmí ztratit rozpracované plánování a dispečeři musí zvládnout odbavit ranní špičku.
- **Otázka:** Kdo bude rozhodovat o prioritách, jaký hlas má dispečink a existuje rozpočtový rámec?
  **Odpověď:** Podle respondentky budou rozhodovat hlavně CEO a CIO. Jana Horáková má do projektu mluvit za provoz a má prakticky veto na věci, které by dispečinku zkomplikovaly práci nebo ohrozily směny. Pokud by projekt znamenal jen rychlý přesun bez řešení pondělních výpadků, měla by s tím zásadní problém. Přesný rozpočet nezná; CEO zmínil orientační hranici, že by to nemělo stát víc než nový kamion ročně.

#### B – Význam slov „cloud“ a „AI“ / tvar řešení
- **Otázka:** Když bude projekt hotový, co budou dispečeři, IT a vedení dělat jinak než dnes?
  **Odpověď:** Dispečeři mají hlavně pracovat bez výpadků a bez obcházek přes papír. IT nemá pořád hasit serverovnu. Vedení má mít jistotu, že provoz stojí na spolehlivém základu.
- **Nabídnutá inspirace:** rychlý přesun aplikace, modernizace provozu, výměna části aplikace, cloudová základna, AI pomoc dispečerům, zpracování CMR a dodacích listů, řidičské mobilní scénáře. → **Reakce:** Respondentka seřadila hodnotu jako: 1) stabilita a odchod ze serverovny, 2) řidičské mobilní scénáře, 3) AI. CMR a dodací listy nejsou její oblast; má je řešit účtárna, konkrétně paní Dvořáková.
- **Otázka:** Co musí být v první fázi, co je mimo první fázi a které řidičské mobilní scénáře nejvíce pomohou dispečinku?
  **Odpověď:** V první fázi musí být stabilní dispečerská aplikace ve špičce a bezpečný přesun tak, aby dispečeři nemuseli ze dne na den měnit základní způsob práce. Mimo první fázi patří složité AI plánování tras a kompletní předělání fakturace. U řidičů by nejvíc pomohlo potvrzení doručení a fotografie důkazu o doručení, protože dnes se hodně věcí řeší přes osobní telefony a WhatsApp skupiny. Hlášení incidentů je také užitečné, ale až po potvrzeních.

#### C – Provoz dispečinku 24/7 a kritičnost
- **Otázka:** Jak vypadá běžná směna a předání směny, kdy jsou špičky a jak vypadal poslední významný incident?
  **Odpověď:** Směny běží 6–14, 14–22 a 22–6. Při předání musí být jasné hlavně zpožděné vozy, neuzavřené zakázky a věci, které už někdo slíbil zákazníkovi. Největší špička je pondělí 6–10, kdy je online přibližně 110 dispečerů; jiné dny jsou rušná také rána, ale ne tak extrémně. Poslední velký incident byl v březnu: aplikace vypadla přibližně na 3,5 hodiny. Náhradní postup přes Excel a telefony fungoval jen krátce; po hodině vznikl chaos. Dopadem bylo zpoždění asi 40 dodávek a jedna smluvní pokuta.
- **Otázka:** Co je při výpadku nejhorší, jak dlouhý neplánovaný výpadek je snesitelný a jaká ztráta dat je přijatelná?
  **Odpověď:** Nejhorší je ztráta rozpracovaných změn a hned potom úplný výpadek, protože potom nikdo neví, kdo co už přeplánoval. Pomalost je také problém, ale aspoň lze něco dělat. Neplánovaný výpadek přes den je snesitelný maximálně asi 15 minut. Plánovaná údržba v noci mezi 22 a 4 by po předchozí domluvě mohla trvat třeba 2 hodiny. Ztráta rozpracovaného plánování by byla katastrofa; pokud vůbec, tak maximálně několik minut, přibližně do 5 minut.


#### D – Uživatelé, role a depa
- **Otázka:** Kdo kromě dispečerů s Dispečinkem pracuje nebo na něm závisí a liší se práce mezi depy?
  **Odpověď:** Kromě dispečerů s Dispečinkem pracují vedoucí směn. Závisí na něm sklady, zákaznický servis a částečně management přes reporty. Respondentka upřesnila dříve používané číslo „150 dispečerů“: kromě 150 dispečerů je ještě asi 40 lidí ve skladech a 12 lidí z obchodu, kteří sledují stav zakázek, takže celkově jde spíše o přibližně 200 uživatelů. Rozdíly v právech mezi Prahou, Brnem a Ostravou přesně nezná, to má doplnit IT. Provozně je Ostrava menší a klidnější.

#### E – Dispečerské workflow a bolesti
- **Otázka:** Popište složitější přepravu od přijetí požadavku po dokončení a kde se používá Dispečink nebo jiné nástroje.
  **Odpověď:** Složitější přeprava začne objednávkou. Dispečer ji plánuje v Dispečinku, sleduje GPS a změny řeší telefonem nebo e-mailem. Po dokončení jde zakázka dál do ERP na fakturaci.
- **Otázka:** Kde se přepisují data, jak dispečer pozná urgentní problém a jak se odpovídá na zákaznický dotaz „kde je zásilka“?
  **Odpověď:** Nejčastěji se přepisuje stav zakázky do e-mailů zákazníkům a poznámky mezi Dispečinkem, telefonem a Excelem při problémech. Urgentní problém dispečer pozná hlavně podle zpoždění auta, volání od řidiče nebo zákazníka, případně podle GPS, když je vůz mimo plán. Při zákaznickém dotazu člověk hledá stav zakázky a polohu v Dispečinku, někdy ještě volá řidiči. Pomalé je ruční skládání odpovědi z obrazovky do e-mailu nebo telefonu a nejednotný styl odpovědí.


#### F/G – Aplikace, data a integrace
- **Otázka:** Kolik přeprav se řeší denně, jak čerstvá musí být GPS poloha a co se stane, když stojí telematika nebo ERP?
  **Odpověď:** Denně se řeší zhruba 2 500 zásilek, v pondělí až kolem 3 800. GPS polohu potřebují dispečeři prakticky hned, protože vůz mimo plán řeší okamžitě. Když stojí telematika, volá se řidičům a práce je pomalejší. ERP je hlavně problém pro dokončení a fakturaci; hotové přepravy se do ERP posílají jednou za noc. Detaily chyb ERP má ověřit IT nebo účtárna.


#### I – Bezpečnost, ochrana dat a regulace
- **Otázka:** Jaká citlivá data Dispečink obsahuje, jak časté jsou ADR přepravy a kdo má odpovědět na NIS2 nebo schvalování AI nad daty?
  **Odpověď:** Dispečink obsahuje údaje o příjemcích, adresy, telefony, údaje o řidičích a jejich polohu, takže GDPR je určitě relevantní téma. ADR přepravy existují, ale nejsou většina; odhad respondentky je přibližně 5 % zásilek. U farmacie jsou požadavky na teplotní log a dohledatelnost, kdo co u zásilky změnil. NIS2 a schvalování AI nad provozními daty musí potvrdit CIO, právník nebo bezpečnost.


#### J/K – Provoz, podpora a bezpečný přechod
- **Otázka:** Kdo dnes řeší incidenty mimo pracovní dobu, jak často se aplikace mění a jak by měl vypadat bezpečný přechod?
  **Odpověď:** V noci a o víkendu incident nejdřív řeší vedoucí směny a volá interní IT. V IT je podle respondentky jen jeden člověk, který aplikaci zná opravdu dobře. Změny dělá partner DevSoft, nasazuje se asi jednou měsíčně, typicky v sobotu večer. Bezpečný přechod by respondentka viděla přes pilot, nejspíš v Ostravě, protože je nejmenší a klidnější, a až potom rozšíření dál. Paralelní provoz by dával smysl aspoň po určitou dobu, ale detaily musí říct IT.


#### L/O – AI výhled a pilot
- **Otázka:** Které AI scénáře dávají smysl pro dispečery a jaká kritéria má splnit pilot v Ostravě?
  **Odpověď:** Z AI by dávalo smysl hlavně připravit odpověď zákazníkovi ke stavu zásilky, ale dispečer ji musí před odesláním schválit. Shrnutí předání směny je také užitečné, pokud lidem nepřidá práci. Návrhy tras respondentka nechce dávat do první vlny; dispečeři si rozhodování o trasách nenechají vzít. Pilot v Ostravě má splnit tři kritéria: aplikace nespadne ve špičce, načtení tabule je výrazně rychlejší a dispečeři nemusí sahat po papírové nebo excelové záloze.


#### M – Řidiči a mobilní použití
- **Otázka:** Jaká zařízení a účty mají řidiči, je potřeba offline režim a koho pozvat do dalších rozhovorů?
  **Odpověď:** Řidiči dnes většinou používají vlastní telefony a WhatsApp skupiny podle depa. Nemají jednotné firemní účty. Offline nebo slabý signál bude potřeba řešit, protože některé sklady a trasy nejsou ideální; přesné požadavky je nutné ověřit s řidiči nebo depem. Do dalších rozhovorů respondentka doporučuje CIO Petra Malého, Pavla Nováka z DevSoftu, Irenu Dvořákovou z účtárny, někoho z právního nebo bezpečnosti kvůli NIS2, zástupce řidičů z Ostravy a ideálně i dopravce/subdodavatele.

#### Kontrola pokrytí a ukončení relace
- **Otázka:** Jak dlouho je potřeba dohledat historii zásilky nebo změn a kdo provozně potvrzuje pilot v Ostravě?
  **Odpověď:** Kvůli účetnictví a sporům se záznamy drží 10 let, ale dispečerům stačí prakticky online posledních 13 měsíců. Pilot v Ostravě by za provoz potvrzovala Jana Horáková společně s vedením ostravského depa; finální rozhodnutí bude u CEO a CIO. Respondentka musela odejít na předání směny.

### Rozpory a upřesnění
Upřesnění: číslo „150 dispečerů“ nepopisuje celkový počet uživatelů Dispečinku. Vedle 150 dispečerů existuje ještě asi 40 skladových uživatelů a 12 lidí z obchodu sledujících stav zakázek, takže celkový počet uživatelů je přibližně 200.

### Otevřené otázky vzniklé v této relaci
OQ-001, OQ-002, OQ-003, OQ-004, OQ-005, OQ-006, OQ-007, OQ-008, OQ-009, OQ-010, OQ-011, OQ-012, OQ-013, OQ-014, OQ-015, OQ-016
