# Zpráva ze zkoušek promptu – Severka Logistika (SIMULACE)

> Fiktivní firma a osoby. Respondenty hrála AI persona se skrytými fakty, tazatele AI subagent s vygenerovaným `PROMPT.md`. Cílem bylo ověřit skill `customer-discovery-interview`, ne získat skutečné požadavky.

## Nastavení

- **Vstup od kolegy:** `../INTAKE.md` (přesun aplikace Dispečink ze serverovny do cloudu, konec nájmu, pondělní špičky, AI jen jako inspirace).
- **Vygenerovaný prompt:** `../PROMPT.md` (česky, bez doporučování produktů).
- **Harness:** dva vícetahoví subagenti. Tazatel má pouze prompt a pracovní složku, persona má pouze kartu faktů (`persona-run1.md`, `persona-run2.md`). Operátor zprávy přeposílá doslovně.
- **Artefakty:** v příkladu jsou složky `run1` a `run4`; run2 a run3 jsou shrnuty jen v této zprávě.
- **Rubrika:** 15 kontrol z `references/testing.md`. Zkouška projde, když projdou kontroly 1, 2, 5, 7, 11 a 12 a nejvýše dvě další jsou Partial.

| Běh | Typ | Respondent | Tahy | Výsledek |
|---|---|---|---|---|
| run1 | úvodní relace | Jana Horáková, vedoucí dispečinku | ~14 | Prošel s vadami → opravy |
| run2 | navazující relace | Petr Malý, CIO | ~10 | **Neprošel** (7, 14) → opravy |
| run3 | navazující relace | Petr Malý, CIO | 15 | Prošel s vadami (11, 14 Partial) → opravy |
| run4 | navazující relace | Petr Malý, CIO | 15 | **Prošel**; 1 zbytková vada → zpřísnění bez dalšího běhu |

## Výsledky kontrol

| # | Kontrola | run1 | run2 | run3 | run4 |
|---|---|---|---|---|---|
| 1 | Zůstává tazatelem, nenavrhuje architekturu | Pass | Pass | Pass | Pass – produkty jen v odpovědích respondenta |
| 2 | Nevymýšlí odpovědi, předpoklady označené | Pass | Pass | Pass | Pass |
| 3 | 1–3 otázky na tah, krátká shrnutí | Pass | Pass | Pass | Pass |
| 4 | Inspirace formou scénářů | Partial – seznam kategorií | n/a | n/a | n/a |
| 5 | Pokrytí a kvantifikace | Partial – bolest bez čísel | Partial | Pass | Pass – 19/20 faktů, 1 částečně |
| 6 | Mezery → otevřené otázky s vlastníkem | Pass | Pass | Pass | Pass – OQ-017 až OQ-022 s rolemi |
| 7 | Žádné předčasné ukončení | Pass | **Fail** – ukončil po potvrzeném shrnutí | Pass | Pass – ukončil v 15. tahu v rámci časového rozpočtu |
| 8 | Úplné soubory, UTF-8, stabilní ID | Pass | Pass | Pass | Pass – 16 kapitol |
| 9 | Seřazené tabulky, stručné buňky | Pass | Pass | Pass | Pass |
| 10 | Shrnutí ≤ 10 bodů | Pass | Pass | Pass | Pass |
| 11 | Zasazené rozpory zachyceny a upřesněny | Pass | Partial | Partial – GPS nezachyceno | Partial – GPS pojmenováno, ale odloženo |
| 12 | Append-only `CONVERSATION.md` | n/a | Pass | Pass | Pass – prefix shodný se zálohou |
| 13 | Žádné zastaralé stavy | n/a | Partial | Pass (OQ-016 otevřené) | Pass – rozpočet v kap. 2 i v OQ-016 |
| 14 | Povinná témata role (licence, klasifikace, AI politika, legacy) | n/a | **Fail** | Partial – bez termínu a rozpočtu | Pass – termín a rozpočet hned v 1. tahu, SA, Purview, EDI, směnové účty, pásmo |
| 15 | Historie změn, řádek na relaci | Pass | Pass | Pass | Pass – verze 1.0, 2.0 |

## Skrytá fakta CIO (run4)

Zachyceno 19 z 20: termín konec září, rozpočet 5 mil. + 3 mil./rok, EU data, NIS2, zákaz veřejného ChatGPT, 800 GB (proti 400 GB), Windows Server 2012 R2 (proti 2016), Veeam a hodinové logy (RPO rozpor), EDI 30 %, SA u paní Šimkové, Purview, pipeline DevSoftu, sdílené směnové účty, konektivita 1 Gbps / 100–300 Mbps, MDM a další.

Nezachyceno:
- **Stavovost v paměti web serveru** (proč se po restartu odhlašuje) – tazatel se na stavovost přímo nezeptal, pouze ji uvedl jako otevřenou otázku pro DevSoft.
- **GPS za 30 s za příplatek** – tazatel rozdíl „prakticky hned“ vs „po 2 minutách“ pojmenoval, ale odložil ho („ještě ověříme“), takže respondent možnost rychlejší frekvence nezmínil.

## Vady a opravy po iteracích

| Po běhu | Vada | Oprava v šabloně |
|---|---|---|
| run1 | Bolest a nadšení bez čísel; inspirace jako seznam k seřazení | Pravidlo kvantifikace; inspirace jako 1–2větý scénář z dne respondenta |
| run2 | Tazatel sám ukončil po potvrzeném shrnutí; chyběla IT povinná témata | „Potvrzené shrnutí není signál konce“; v navazující relaci projít OQ a povinná témata role; IT témata v roli a v kontrole pokrytí; self-check ve SKILL.md |
| run3 | Rozpor potřeba vs realita (GPS) nezachycen; termín a rozpočet nezjištěny; „5 minut“ bráno jako konec | Rozpor zahrnuje i potřebu proti technické realitě; tvrdá omezení v první třetině; poslední minuty na 1–2 nejdůležitější mezery |
| run4 | Rozpor pojmenován, ale odložen místo upřesnění | Upřesnit ve stejném tahu (která hodnota platí, co by stálo odstranění rozdílu); OQ jen když respondent nemůže odpovědět |

Oprava po run4 je v šabloně, `SKILL.md`, `references/testing.md` i v `PROMPT.md`. Nový běh už nebyl spuštěn, protože byl vyčerpán limit tří iterací.

## Zbytková rizika

- **Odložené rozpory:** pravidlo je zpřísněné, ale po run4 ověřené není. Při prvním reálném použití zkontrolujte sekci „Rozpory a upřesnění“.
- **Technické detaily do hloubky:** v 45 minutách s CIO zůstávají některé detaily (stavovost aplikace) jen jako otevřené otázky pro dodavatele. Je to přijatelné, ale architekt musí na tyto OQ navázat.
- **Věrnost persony:** persona v run4 nepoužila signál „mám 5 minut“, takže pravidlo „poslední minuty“ se v run4 neověřilo (ověřeno částečně v run3). Simulace nenahrazuje reálný rozhovor.
- **Tazatel s rozpočtem času:** ukončení v 15. tahu odpovídá 45 minutám, ale tazatel ukončil sám, bez výslovného signálu respondenta. Pro delší relace hlídejte kontrolu pokrytí.
