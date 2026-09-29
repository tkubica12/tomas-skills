# Transcript – rehearsal run 4, follow-up (SIMULATED)

**Respondent (operator start):** Dobrý den, tady Petr Malý, CIO. Mám teď asi 45 minut.

**Interviewer:** Dobrý den, pane Malý. Navážu na první rozhovor:

Už víme hlavně:
- termín tlačí konec nájmu serverovny,
- provoz chce stabilitu pondělních špiček, ne jen „přestěhování“,
- Dispečink je 24/7 kritický systém,
- max denní výpadek je odhadem 15 minut, ztráta dat cca 5 minut,
- aplikace má SQL cca 400 GB a integrace na telematiku a Helios,
- otevřené zůstává hlavně IT provedení, cloudová základna, identity, síť, bezpečnost, zálohy, provoz a licence.

Agenda pro vás: technická proveditelnost migrace, cloudová základna, integrace, dostupnost/obnova, bezpečnost a regulace, provozní model, náklady a pilot.

Na začátek tři tvrdá omezení:
1. Je termín „do konce příštího roku“ pevný? Existují mezitermíny?
2. Máte rozpočtový strop nebo investiční rámec?
3. Máte pravidla k umístění dat, regulaci, NIS2 nebo používání AI nad provozními daty?

**Respondent:** Dobrý den. Termín je pevný v tom smyslu, že nájem serverovny končí 31. 12. příštího roku, ale já bych chtěl mít migraci hotovou nejpozději do konce září, protože Q4 je u nás špička před Vánoci. Rozpočtově máme potvrzený rámec zhruba do 5 mil. Kč jednorázově na migraci a provozně kolem 3 mil. Kč ročně. K datům: nový pharma zákazník požaduje, aby data zůstala v EU a vyhrazuje si audit. NIS2 posuzuje právník, spíš pod to spadneme, finální stanovisko čekám do konce roku. Veřejný ChatGPT máme pro zákaznická data zakázaný, běží jen pilot M365 Copilotu pro kancelář.

**Interviewer:** Děkuji, beru to jako zpřesnění: cílový termín migrace je konec září, ne až prosinec; rozpočet je cca 5 mil. Kč jednorázově a 3 mil. Kč ročně. Zapsal jsem také EU data, audit pharma zákazníka, rozpracovanou NIS2 a zákaz veřejného ChatGPT pro zákaznická data.

Teď cloudová základna a provozní připravenost:

1. Jaké cloudové prostředí dnes Severka reálně má – jen trial, nebo už tenant/subscription/projekt s pravidly pro produkci?
2. Kdo dnes spravuje identity, administrátorské účty a přístupy externího partnera?
3. Máte už definované oddělení dev/test/prod, monitoring, zálohy a nákladové řízení pro cloud?

**Respondent:** Máme Microsoft 365 tenant a k tomu jednu malou Azure subscription pro dev/test, placenou kartou, ale není to produkčně připravené prostředí. Nemáme landing zone, síťový model ani hybridní konektivitu do Azure; spíš pár pokusů než řízený cloud. Identity spravujeme my přes on-prem AD synchronizované do Entra ID přes Entra Connect, MFA máme pro kancelářské uživatele. Externí DevSoft má přístupy řešené historicky, chtěl bych to zpřísnit a mít jasné role. Dev/test/prod v cloudu definované nemáme, monitoring máme Zabbix hlavně na servery, aplikační monitoring prakticky ne. Nákladové řízení v Azure dnes také není nastavené.

**Interviewer:** Rozumím. Zapisují se tím dva závěry: dnes máte spíš experimentální Azure než produkční cloudovou základnu a vedle migrace Dispečinku bude nutné vybudovat minimální řízený provozní rámec. Také beru, že identity stojí na AD → Entra ID a partnerovy přístupy jsou riziko ke zpřísnění.

Přejdu k aplikaci, datům a závislostem:

1. Víte, jak je Dispečink technicky závislý na lokální síti/serverech – souborové sdílení, tisk, Windows služba, integrační fronty, uložené soubory?
2. Používá SQL Server něco specifického: SQL Agent joby, SSIS, linked servery, CLR, reportovací databázi?
3. Kde fyzicky běží Helios a telematická integrace – ve vaší serverovně, u dodavatelů, nebo kombinovaně?

**Respondent:** Dispečink je ASP.NET webová aplikace na IIS, .NET Framework 4.8, plus jedna Windows služba pro plánovací joby. Běží to na dvou aplikačních serverech Windows Server 2012 R2, vím, že už je to problém. SQL je SQL Server 2016 Standard, databáze má spíš kolem 800 GB, ne 400; roste asi o 60 GB ročně. Máme SQL Agent joby pro noční zpracování, SSRS reporty a jeden linked server do Heliosu. Helios běží on-prem u nás ve stejné serverovně a napojení je přes noční dávku přes linked server. Telematika je od dodavatele, ten posílá GPS pozice přes REST zhruba každé 2 minuty.

**Interviewer:** Děkuji, tady je důležité upřesnění: proti původním 400 GB eviduji cca 800 GB a růst 60 GB/rok; proti původnímu Windows Server 2016 eviduji aplikační servery Windows Server 2012 R2. GPS „prakticky hned“ teď technicky znamená cca každé 2 minuty – ještě ověříme, zda to cílově stačí.

Teď dostupnost, obnova a migrace:

1. Jak dnes zálohujete SQL a aplikační servery? Máte pravidelně testovanou obnovu?
2. Máte druhou lokalitu nebo disaster recovery, nebo je vše v jedné serverovně?
3. Jak byste si představoval přechod: víkendové přepnutí, paralelní provoz, pilot Ostrava, rollback?

**Respondent:** Dnes máme Veeam: noční full backup a transakční logy každou hodinu na NAS ve stejné serverovně. Obnovu jsme testovali spíš ad hoc, ne jako pravidelné DR cvičení. Druhou lokalitu nemáme, reálně je všechno v jedné serverovně, včetně NASu, což není ideální. Hodina ztracených dat je dnešní realita; jestli by cílem mělo být 5 minut, tak to beru jako target, ale dnes to neumíme.

Přechod bych nechtěl „big bang“ bez návratu. Dává mi smysl pilot třeba na jedné pobočce nebo části uživatelů, pak víkendové přepnutí s jasným rollbackem. Ostrava by mohla být pilot, ale musel bych to potvrdit s provozem.

**Interviewer:** Tohle je zásadní rozdíl: byznys target 5 minut ztráty dat je v pořádku jako cíl, ale dnešní stav je spíš 1 hodina a navíc vše ve stejné serverovně. Zapisuji to jako rozpor mezi požadavkem a současnou schopností.

Shrnu dosud za IT oblast:
- produkční cloudová základna chybí,
- databáze je cca 800 GB, růst 60 GB/rok,
- Helios je ve stejné serverovně,
- telematika posílá GPS cca po 2 minutách,
- dnešní DR není geograficky odolné,
- přechod má mít pilot a rollback, ne big bang.

Další dvě témata: licence a provozní model.

1. Máte Software Assurance nebo licenční mobilitu pro Windows Server / SQL Server, nebo to zatím nevíte?
2. Kdo má po migraci držet provozní odpovědnost: interní IT, DevSoft, jiný provozní partner, nebo kombinace?
3. Má interní tým kapacitu na 24/7 podporu kritického cloudového systému?

**Respondent:** Software Assurance u SQL a Windows Server licencí nevím, to má nákup, konkrétně paní Šimková. Máme Microsoft EA, ale detaily licenční mobility teď nechci tipovat. Provozní odpovědnost bych nechtěl nechat čistě na našem interním IT, máme 5 lidí a nejsme 24/7 cloud operations tým. Preferoval bych managed service nebo partnera pro infrastrukturu/provoz, s jasným SLA, a DevSoft spíš pro aplikační změny. Hlavně nechci další železo a další věci, které budeme sami hlídat v noci.

**Interviewer:** Zapsal jsem: licence nehádat, ověřit u paní Šimkové; cílově managed service/provozní partner s jasným SLA, DevSoft hlavně aplikační změny. To je důležité i pro rozpočet a provozní model.

Zbývá mi doplnit bezpečnostní pravidla a konektivitu:

1. Jaká síťová napojení bude Dispečink po migraci potřebovat – depa, Helios, tiskárny/sklady, dodavatel telematiky, případně VPN pro DevSoft?
2. Máte dnes klasifikaci dat nebo bezpečnostní politiky pro šifrování, logování, privilegované účty a administrátorské zásahy?
3. Kdo má formálně schvalovat přesun kritického systému do cloudu – vy, bezpečnost, CEO, právník, pharma zákazník?

**Respondent:** Napojení určitě depa a kanceláře, v Brně máme internet 1 Gbps, depa mají různé linky zhruba 100 až 300 Mbps. Helios je zatím on-prem, takže po migraci buď musí být konektivita zpět, nebo se musí řešit jeho budoucnost zvlášť. Telematika jde přes REST od dodavatele z internetu, tam nepředpokládám VPN, ale musí se to zabezpečit. DevSoft dnes přistupuje historicky přes VPN, chtěl bych to nahradit něčím řízenějším.

Klasifikaci dat nemáme, sensitivity labels ani Purview nejsou nastavené. Šifrování a logování máme spíš standardně na úrovni serverů, ne jako propracovanou politiku pro privilegované akce. Schválení půjde přes mě, CEO, právníka kvůli NIS2 a smlouvám, a u pharma zákazníka očekávám minimálně audit nebo formální odsouhlasení architektury.

**Interviewer:** Děkuji. Zapisuji, že konektivita není jen „uživatelé do cloudu“, ale také rozhodnutí kolem Heliosu. A bezpečnostně chybí klasifikace dat i detailní politika privilegovaných zásahů; schvalování půjde přes vás, CEO, právníka a pravděpodobně pharma audit/odsouhlasení.

Zbývá nám rozhodnutí o první vlně a ověření:

1. Má být první vlna spíš co nejbezpečnější migrace stávající aplikace, nebo zároveň technická modernizace aplikace? Co je minimum, bez kterého byste to neschválil?
2. Co je výslovně mimo rozsah do září?
3. Jak chcete ověřit připravenost před ostrým přepnutím – zátěžový test, DR test, pilot, bezpečnostní review, akceptace provozem?

**Respondent:** První vlna má být bezpečná migrace a odstranění největších rizik, ne kompletní přepis aplikace. Minimum pro schválení je stabilní provoz pondělní špičky, jasný rollback, lepší RPO/RTO než dnes, zabezpečené přístupy a dohled, a aby to prošlo právně a u pharma zákazníka. Modernizace ano tam, kde je nutná pro cloud nebo podporu, ale nechci z toho udělat dvouletý rewrite.

Mimo rozsah do září bych dal kompletní redesign Dispečinku, výměnu Heliosu a plošné zavedení MDM pro všechny řidiče. U řidičů jsme otevření jednoduché webové aplikaci s jednorázovými kódy, ale firemní telefony ani MDM dnes nemáme. Připravenost bych chtěl ověřit zátěžovým testem, DR testem, pilotem na omezené skupině, bezpečnostním review a formální akceptací provozem.

**Interviewer:** Děkuji, to jasně vymezuje první vlnu: bezpečná migrace + odstranění největších rizik, ne rewrite. Mimo září dávám redesign Dispečinku, výměnu Heliosu a plošné MDM/telefony pro řidiče; jednoduchý web s jednorázovými kódy jen jako možnost k posouzení.

Mám poslední rychlé kolo k doplnění čísel a vlastníků:

1. Jaký cílový RTO byste za IT považoval za schvalovatelný – do 15 minut podle byznysu, nebo jiná hodnota pro celé prostředí?
2. Kdo bude vlastnit ERP/Helios rozhodnutí a kdo bezpečnostní klasifikaci – konkrétní role/jména?
3. Kdo má být v dalším technickém workshopu kromě vás, DevSoftu a bezpečnosti?

**Respondent:** Za IT bych jako schvalovatelné bral RTO do 15 minut pro kritický Dispečink, pokud to bude reálně otestované, ne jen napsané v dokumentu. Pro celé okolní prostředí, třeba reporting nebo noční dávky do Heliosu, může být cílová hodnota delší, ale nesmí to zastavit dispečery v provozu.

Helios rozhodnutí by měl vlastnit finanční/ERP proces spolu se mnou, prakticky bych tam přizval naši finanční ředitelku a klíčového člověka od Heliosu. Bezpečnostní klasifikaci musí spoluvlastnit právník a IT, já to můžu garantovat technicky. Do dalšího workshopu bych vzal Janu Horákovou za dispečink, Pavla Nováka z DevSoftu, někoho z nákupu kvůli licencím – paní Šimkovou – a zástupce provozu dep.

**Interviewer:** Děkuji, zapisují se tím vlastníci: Helios finanční/ERP proces + vy, klasifikace právník + IT, technický workshop s Janou Horákovou, Pavlem Novákem, paní Šimkovou a provozem dep.

Mám ještě 2 krátká témata, každé asi 3 minuty:

1. **Náklady a governance:** kdo má po spuštění schvalovat měsíční cloudové náklady, rozpočtové alerty a změny infrastruktury?
2. **Zbylé závislosti ve serverovně:** jsou v té serverovně kromě Dispečinku, SQL, Heliosu a NASu ještě souborové sdílení, tiskové služby, EDI, skladové systémy nebo něco, co by migraci Dispečinku mohlo skrytě blokovat?

**Respondent:** Měsíční cloudové náklady bych chtěl schvalovat já spolu s financemi, prakticky asi CFO nebo jí určený člověk. Potřebujeme rozpočtové alerty, tagování a jasné pravidlo, kdo může měnit velikosti služeb nebo přidávat nové prostředky. Dnes to v Azure takhle nemáme.

Ve serverovně jsou kromě toho i běžné souborové služby a některé tiskové věci, ale nemyslím, že by přímo blokovaly Dispečink. EDI běží přes DataLink EDI Hub, je to SFTP file drop každých 15 minut v EDIFACTu; týká se dvou zákazníků a asi 30 % objednávek. To musíme do migrace zahrnout, protože provozně je to důležité.

**Interviewer:** Děkuji. Doplňuji nákladovou governance: měsíční náklady CIO + finance/CFO, nutné alerty, tagování a pravidla změn služeb. Důležitá nová závislost je EDI: DataLink EDI Hub, SFTP každých 15 minut v EDIFACTu, 2 zákazníci a cca 30 % objednávek – to musí být v migračním plánu.

Krátké ověření k EDI:
1. Kdo DataLink EDI Hub vlastní/provozuje – interně, dodavatel, nebo zákazníci?
2. Co se stane, když EDI stojí třeba hodinu: lze objednávky dočasně zadat ručně, nebo se provoz reálně zastaví?

**Respondent:** DataLink EDI Hub provozuje externí poskytovatel, my na naší straně zpracováváme SFTP drop a napojení do Dispečinku/objednávek. Zákazníci do toho posílají EDIFACT zprávy přes svého EDI partnera, ale primární smluvní vztah k hubu máme my.

Když EDI stojí hodinu, provoz se úplně nezastaví, ale začne se tvořit fronta a u těch dvou zákazníků je to citlivé. Nouzově lze část objednávek zadat ručně, ale není to realistické jako dlouhodobý režim, protože je to asi 30 % objemu.

**Interviewer:** Děkuji, EDI doplňuji jako kritickou integrační závislost: externí hub, smlouva na vaší straně, výpadek hodinu vytvoří frontu a ruční režim je jen krátkodobá nouze.

Kontrolní shrnutí CIO části:
- první vlna = bezpečná migrace, ne rewrite,
- cílově RTO 15 min a RPO 5 min, dnes neumíte,
- chybí produkční cloudová základna,
- klíčové integrace: Helios, telematika, EDI,
- nutný managed service/provozní partner,
- právní/NIS2/pharma audit jsou schvalovací brány.

Je to přesné? Pokud ano, poslední otázka: je ještě nějaké tvrdé omezení nebo závislost, kterou jsme nepojmenovali?

**Respondent:** Ano, to shrnutí je přesné. Doplnil bych jen, že zdrojový kód podle smlouvy patří Severce, ale DevSoft dnes buildí ze svého Gitu a my nemáme kopii build pipeline. To bych chtěl před migrací nebo nejpozději v rámci ní dostat pod naši kontrolu, jinak jsme moc závislí na jednom dodavateli. A ještě prakticky: u dispečerů v depech jsou sdílené směnové účty na společných PC, což může být problém pro audit, kdo co změnil.

**Interviewer:** Děkuji, to jsou dvě důležité závislosti. Zapisuji:
- kód sice smluvně patří Severce, ale build je dnes v Gitu DevSoftu a pipeline nemáte pod kontrolou,
- sdílené směnové účty na společných PC jsou v konfliktu s auditní dohledatelností změn.

Ještě k nim potřebuji krátce doplnit:

1. U build pipeline: má být cílem úplné převzetí do prostředí Severky, nebo stačí zrcadlení a auditovatelný release proces s DevSoftem?
2. U sdílených účtů: je pro dispečery přijatelné osobní přihlašování při každé směně, nebo potřebujete model, který nezdržuje předání a práci na společném PC?

**Respondent:** U build pipeline bych preferoval úplné převzetí do prostředí Severky nebo minimálně náš repozitář jako autoritativní mirror, ze kterého jde udělat auditovatelný release. Nechci DevSoft obejít, ale chci mít jistotu, že když se něco stane, víme přesně, co je nasazené a z čeho se to postavilo.

U sdílených účtů bych rád osobní dohledatelnost, ale nesmí to dispečery zdržovat při předání směny. Ideálně model, kde se na společném PC dá rychle přihlásit konkrétní člověk nebo potvrdit akce osobně, bez dlouhého odhlašování a přihlašování každých pár minut.

**Interviewer:** Děkuji, doplněno: pipeline ideálně převzít, minimálně autoritativní mirror Severky a auditovatelný release; u účtů cílově osobní dohledatelnost bez zdržení směny.

Mám pokrytou CIO agendu. Před závěrečným zápisem shrnu hlavní zjištění k potvrzení:

- první vlna: bezpečná migrace do konce září, ne rewrite,
- rozpočet: cca 5 mil. Kč migrace, 3 mil. Kč roční provoz,
- dnešní Azure není produkční základna; chybí síť, landing zone, monitoring, nákladová governance,
- DB cca 800 GB, růst 60 GB/rok; SQL Agent, SSRS, linked server,
- kritické integrace: Helios, telematika, EDI DataLink,
- cíle: RTO 15 min, RPO 5 min, oboje testovat,
- nutný managed service/provozní partner,
- právník/NIS2/pharma audit a osobní auditovatelnost jsou zásadní.

Je to správně?

**Respondent:** Ano, souhlasí. Jen bych zdůraznil, že RTO/RPO jsou cíle pro kritický Dispečink a musí být prokázané testem, ne jen SLA v nabídce. U ostatních částí, jako reporty nebo noční dávky, může být režim mírnější, pokud to neohrozí provoz. Jinak je shrnutí za mě správně.

**Interviewer:** Děkuji, relaci uzavírám. Hlavní otevřené body: Nákup / paní Šimková: SA a licenční mobilita; DevSoft + IT: převzetí/mirror repozitáře a build pipeline, stavovost a skryté závislosti; Právník + IT/bezpečnost: NIS2, klasifikace dat, privilegované zásahy, sdílené účty; Finance/ERP: budoucnost Heliosu; IT/provoz: EDI v testech, pilot, rollback, RTO/RPO testy; Provoz dep: potvrzení Ostravy pro pilot. Aktualizoval jsem CONVERSATION.md a REQUIREMENTS.md.

> Simulated rehearsal; respondent played by an AI persona with hidden facts.
