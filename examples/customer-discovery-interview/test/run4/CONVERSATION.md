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

## Relace 2 – 2026-05-19
- **Respondent:** Petr Malý, CIO, IT
- **Délka / rozsah:** cca 45 minut; navazující relace se zaměřením na CIO/IT pohled
- **Pokryté oblasti:** A; B; F; G; H; I; J; K; M; N; O; kontrola pokrytí

### Shrnutí relace
- CIO zpřesnil cílový termín migrace na konec září příštího roku kvůli Q4 špičce; nájem serverovny končí 31. 12.
- Rozpočtový rámec je cca 5 mil. Kč jednorázově na migraci a cca 3 mil. Kč ročně na provoz.
- Dnešní Azure prostředí není produkční základna: chybí landing zone, síťový model, hybridní konektivita, oddělení prostředí, aplikační monitoring a nákladová governance.
- Technický profil byl zásadně upřesněn: IIS/.NET Framework 4.8, Windows služba, Windows Server 2012 R2, SQL Server 2016 Standard, databáze cca 800 GB a růst cca 60 GB ročně.
- Kritické integrace jsou Helios on-prem přes linked server/noční dávku, telematika přes REST cca každé 2 minuty a DataLink EDI Hub přes SFTP každých 15 minut pro cca 30 % objednávek.
- Cíle pro kritický Dispečink jsou RTO do 15 minut a RPO cca 5 minut, oboje prokazatelné testem; dnešní stav je cca 1 hodina RPO a zálohy ve stejné serverovně.
- První vlna má být bezpečná migrace a odstranění největších rizik, ne kompletní rewrite; mimo rozsah do září jsou výměna Heliosu, redesign Dispečinku a plošné MDM/telefony pro řidiče.
- Provozní model má využít managed service nebo provozního partnera s jasným SLA; interní IT má 5 lidí a není 24/7 cloud operations tým.
- Schvalovací a bezpečnostní brány: EU umístění dat, pharma audit/odsouhlasení architektury, právník kvůli NIS2, klasifikace dat, řízené přístupy DevSoftu a audit privilegovaných akcí.
- Nová rizika: DevSoft builduje ze svého Gitu bez pipeline pod kontrolou Severky a v depech existují sdílené směnové účty, které komplikují audit změn.

### Průběh podle oblastí

#### A/N/I/O – Tvrdá omezení, termíny, rozpočet, data a AI
- **Otázka:** Je termín odchodu ze serverovny pevný, existují mezitermíny, jaký je rozpočtový rámec a jaká pravidla platí pro data, regulaci a AI?
  **Odpověď:** Nájem serverovny končí 31. 12. příštího roku, ale CIO chce mít migraci hotovou nejpozději do konce září, protože Q4 je předvánoční špička. Rozpočtový rámec je přibližně do 5 mil. Kč jednorázově na migraci a okolo 3 mil. Kč ročně na provoz. Nový pharma zákazník požaduje, aby data zůstala v EU, a vyhrazuje si audit. Posouzení NIS2 dělá právník; CIO očekává, že Severka pod NIS2 spíše spadne, finální stanovisko čeká do konce roku. Veřejný ChatGPT je pro zákaznická data zakázaný; běží jen pilot M365 Copilotu pro kancelář.

#### N – Cloudová základna, identity, monitoring a náklady
- **Otázka:** Jaké cloudové prostředí dnes Severka má, kdo spravuje identity a jak jsou řešené přístupy partnera, prostředí, monitoring a nákladové řízení?
  **Odpověď:** Severka má Microsoft 365 tenant a jednu malou Azure subscription pro dev/test, placenou kartou. Není to produkčně připravené prostředí; neexistuje landing zone, síťový model ani hybridní konektivita do Azure. CIO to popisuje spíše jako pokusy než řízený cloud. Identity spravuje interní IT přes on-premises AD synchronizované do Entra ID pomocí Entra Connect; MFA je zapnuté pro kancelářské uživatele. Přístupy externího partnera DevSoft jsou historické a CIO je chce zpřísnit s jasnými rolemi. Dev/test/prod prostředí v cloudu nejsou definovaná. Monitoring je Zabbix hlavně na servery; aplikační monitoring prakticky není. Nákladové řízení v Azure dnes není nastavené.

#### F/G – Technický profil aplikace, SQL a integrace
- **Otázka:** Jaké jsou technické závislosti Dispečinku, specifické funkce SQL Serveru a kde běží Helios a telematická integrace?
  **Odpověď:** Dispečink je ASP.NET webová aplikace na IIS a .NET Framework 4.8 plus jedna Windows služba pro plánovací joby. Běží na dvou aplikačních serverech Windows Server 2012 R2, což CIO označuje za problém. SQL Server je 2016 Standard; databáze má spíše kolem 800 GB, ne 400 GB, a roste asi o 60 GB ročně. Používají se SQL Agent joby pro noční zpracování, SSRS reporty a jeden linked server do Heliosu. Helios běží on-premises ve stejné serverovně a napojení probíhá přes noční dávku přes linked server. Telematika je u dodavatele; GPS pozice posílá přes REST zhruba každé 2 minuty.

#### H/K – Zálohy, obnova, DR a přechod
- **Otázka:** Jak dnes zálohujete SQL a aplikační servery, máte druhou lokalitu nebo DR a jaký přechod by byl přijatelný?
  **Odpověď:** Dnes se používá Veeam: noční full backup a transakční logy každou hodinu na NAS ve stejné serverovně. Obnova se testovala spíše ad hoc, ne jako pravidelné DR cvičení. Druhá lokalita není; reálně je vše v jedné serverovně včetně NASu, což CIO považuje za neideální. Hodina ztracených dat je dnešní realita. Cíl 5 minut bere CIO jako target, ale dnes ho Severka neumí. Přechod nemá být big bang bez návratu. CIO preferuje pilot na jedné pobočce nebo části uživatelů, poté víkendové přepnutí s jasným rollbackem. Ostrava může být pilot, ale musí to potvrdit s provozem.

#### J/N – Licence a provozní model
- **Otázka:** Má Severka Software Assurance nebo licenční mobilitu pro Windows Server / SQL Server, kdo má nést provozní odpovědnost po migraci a má interní tým kapacitu na 24/7 cloudový provoz?
  **Odpověď:** CIO neví, zda má Severka Software Assurance nebo licenční mobilitu pro SQL a Windows Server; licenční detaily má nákup, konkrétně paní Šimková. Severka má Microsoft EA, ale CIO nechce tipovat detaily licenční mobility. Provozní odpovědnost nechce nechat čistě na interním IT, protože tým má 5 lidí a není 24/7 cloud operations tým. Preferuje managed service nebo infrastrukturně-provozního partnera s jasným SLA; DevSoft má být spíše pro aplikační změny. CIO nechce další železo ani další věci, které bude interní IT samo hlídat v noci.

#### I/N – Konektivita, bezpečnostní politiky a schvalování cloudu
- **Otázka:** Jaká síťová napojení bude Dispečink po migraci potřebovat, jaké existují bezpečnostní politiky a kdo schvaluje přesun kritického systému do cloudu?
  **Odpověď:** Dispečink bude potřebovat napojení na depa a kanceláře. Brno má internet 1 Gbps, ostatní depa mají různé linky přibližně 100 až 300 Mbps. Helios je zatím on-premises, takže po migraci Dispečinku bude potřeba buď konektivita zpět k Heliosu, nebo samostatně vyřešit budoucnost Heliosu. Telematika jde přes REST od dodavatele z internetu; CIO nepředpokládá VPN, ale integrace musí být zabezpečená. DevSoft dnes přistupuje historicky přes VPN a CIO to chce nahradit řízenějším přístupem. Klasifikace dat není zavedena; sensitivity labels ani Purview nejsou nastavené. Šifrování a logování existují spíše standardně na úrovni serverů, ne jako propracovaná politika pro privilegované akce. Přesun kritického systému do cloudu bude schvalovat CIO, CEO, právník kvůli NIS2 a smlouvám a u pharma zákazníka CIO očekává minimálně audit nebo formální odsouhlasení architektury.

#### K/O – První vlna, rozsah do září a ověření připravenosti
- **Otázka:** Má být první vlna bezpečná migrace nebo modernizace, co je minimum pro schválení, co je mimo rozsah do září a jak se ověří připravenost?
  **Odpověď:** První vlna má být bezpečná migrace a odstranění největších rizik, ne kompletní přepis aplikace. Minimum pro schválení je stabilní provoz pondělní špičky, jasný rollback, lepší RPO/RTO než dnes, zabezpečené přístupy a dohled a právní i pharma průchodnost. Modernizace je přijatelná tam, kde je nutná pro cloud nebo podporu, ale CIO nechce dvouletý rewrite. Mimo rozsah do září patří kompletní redesign Dispečinku, výměna Heliosu a plošné zavedení MDM pro všechny řidiče. U řidičů je Severka otevřená jednoduché webové aplikaci s jednorázovými kódy, ale firemní telefony ani MDM dnes nemá. Připravenost před ostrým provozem má ověřit zátěžový test, DR test, pilot na omezené skupině, bezpečnostní review a formální akceptace provozem.

#### H/O – Cílové RTO a vlastníci navazujících rozhodnutí
- **Otázka:** Jaký cílový RTO je za IT schvalovatelný, kdo vlastní rozhodnutí kolem Heliosu a bezpečnostní klasifikace a kdo má být v dalším workshopu?
  **Odpověď:** Za IT je pro kritický Dispečink schvalovatelný RTO do 15 minut, pokud bude reálně otestovaný, ne jen deklarovaný. Pro okolní prostředí, například reporting nebo noční dávky do Heliosu, může být cílová hodnota delší, ale nesmí zastavit dispečery v provozu. Rozhodnutí kolem Heliosu má vlastnit finanční/ERP proces společně s CIO; prakticky má být přizvána finanční ředitelka a klíčový člověk od Heliosu. Bezpečnostní klasifikaci musí spoluvlastnit právník a IT; CIO ji může garantovat technicky. Do dalšího workshopu mají být přizváni Jana Horáková za dispečink, Pavel Novák z DevSoftu, paní Šimková z nákupu kvůli licencím a zástupce provozu dep.

#### N/G – Nákladová governance a zbylé závislosti serverovny
- **Otázka:** Kdo má po spuštění schvalovat měsíční cloudové náklady, rozpočtové alerty a změny infrastruktury a jsou ve serverovně další závislosti, které mohou migraci blokovat?
  **Odpověď:** Měsíční cloudové náklady má schvalovat CIO společně s financemi, prakticky CFO nebo jí určený člověk. Severka potřebuje rozpočtové alerty, tagování a jasné pravidlo, kdo může měnit velikosti služeb nebo přidávat nové prostředky; dnes to v Azure nastavené není. Ve serverovně jsou běžné souborové služby a některé tiskové věci, ale CIO si nemyslí, že by přímo blokovaly Dispečink. Důležitá je EDI integrace přes DataLink EDI Hub: SFTP file drop každých 15 minut v EDIFACTu, týká se dvou zákazníků a asi 30 % objednávek. CIO říká, že EDI musí být zahrnuto do migrace, protože je provozně důležité.

#### G – EDI vlastnictví a dopad výpadku
- **Otázka:** Kdo DataLink EDI Hub vlastní/provozuje a co se stane, když EDI stojí přibližně hodinu?
  **Odpověď:** DataLink EDI Hub provozuje externí poskytovatel. Severka na své straně zpracovává SFTP drop a napojení do Dispečinku/objednávek. Zákazníci posílají EDIFACT zprávy přes svého EDI partnera, ale primární smluvní vztah k hubu má Severka. Pokud EDI stojí hodinu, provoz se úplně nezastaví, ale začne se tvořit fronta a u dvou dotčených zákazníků je to citlivé. Nouzově lze část objednávek zadat ručně, ale není to realistické jako dlouhodobý režim, protože EDI pokrývá asi 30 % objemu.

#### J/I – Zdrojový kód, build pipeline a sdílené účty
- **Otázka:** Je ještě nějaké tvrdé omezení nebo závislost, kterou jsme nepojmenovali?
  **Odpověď:** CIO potvrdil shrnutí a doplnil dvě závislosti. Zdrojový kód podle smlouvy patří Severce, ale DevSoft dnes builduje ze svého Gitu a Severka nemá kopii build pipeline. CIO chce před migrací nebo nejpozději v jejím rámci dostat kód a build pipeline pod kontrolu Severky, jinak je firma příliš závislá na jednom dodavateli. U dispečerů v depech jsou také sdílené směnové účty na společných PC, což může být problém pro audit toho, kdo co změnil.

#### J/I – Cílový model pipeline a osobní dohledatelnosti
- **Otázka:** Má být cílem úplné převzetí build pipeline do prostředí Severky, nebo stačí zrcadlení, a jaký model je přijatelný pro osobní dohledatelnost na společných PC?
  **Odpověď:** CIO preferuje úplné převzetí build pipeline do prostředí Severky, nebo minimálně autoritativní repozitářový mirror Severky, ze kterého lze udělat auditovatelný release. Nechce obejít DevSoft, ale chce mít jistotu, že Severka přesně ví, co je nasazené a z čeho se to postavilo. U sdílených účtů chce osobní dohledatelnost, ale bez zdržování dispečerů při předání směny. Ideální je model, kde se na společném PC může rychle přihlásit konkrétní člověk nebo osobně potvrdit akce, bez dlouhého odhlašování a přihlašování každých pár minut.

#### Kontrola pokrytí a potvrzení shrnutí
- **Otázka:** Je závěrečné shrnutí CIO části přesné a chybí ještě nějaké upřesnění?
  **Odpověď:** CIO shrnutí potvrdil. Zdůraznil, že RTO/RPO jsou cíle pro kritický Dispečink a musí být prokázané testem, ne jen SLA v nabídce. U ostatních částí, jako reporty nebo noční dávky, může být režim mírnější, pokud to neohrozí provoz.


### Rozpory a upřesnění
Upřesnění: Dřívější orientační rozpočtový popis „ne víc než nový kamion ročně“ CIO zpřesnil na rámec cca 5 mil. Kč jednorázově na migraci a cca 3 mil. Kč ročně na provoz. Termín odchodu ze serverovny zůstává 31. 12. příštího roku, ale CIO doplnil interní migrační mezník nejpozději konec září kvůli Q4 špičce.
Rozpor/upřesnění: Vstupní kontext uváděl Windows Server 2016 a databázi cca 400 GB; CIO upřesnil aplikační servery na Windows Server 2012 R2 a databázi na cca 800 GB s růstem cca 60 GB ročně.
Upřesnění: Byznys formulace „GPS prakticky hned“ odpovídá dnešní technické frekvenci telematiky cca každé 2 minuty přes REST od dodavatele; zda je to cílově dostačující, je nutné potvrdit s dispečinkem a IT.
Rozpor: Byznys cíl z relace 1 je ztráta dat maximálně cca 5 minut, ale dnešní technická realita je transakční log každou hodinu a zálohy i NAS ve stejné serverovně. CIO bere 5 minut jako cílový target, který dnes Severka neumí.
Rozpor/upřesnění: Požadavek na audit změn u farmaceutických zásilek a auditovatelnost cloudu naráží na dnešní sdílené směnové účty na společných PC v depech. Je nutné určit cílový model identit a auditní odpovědnost.

### Otevřené otázky vzniklé v této relaci
OQ-017, OQ-018, OQ-019, OQ-020, OQ-021, OQ-022
