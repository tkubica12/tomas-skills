# Intake and scope proposal – Severka Logistika s.r.o. discovery prompt

## Phase 1 – intake summary

| Item | Summary |
|---|---|
| Customer | Severka Logistika s.r.o. – fictional Czech regional road-freight and warehousing company. |
| Scale | Approx. 900 employees, three depots: Praha, Brno, Ostrava. No parent group. |
| Customer stated intent | „Chceme dostat dispečerskou aplikaci do cloudu a možná tam přidat nějakou AI pro dispečery.“ |
| Vague parts | “Cloud” may mean rehosting VMs, application modernization, replacement, managed database, cloud foundation, or datacenter exit. “AI for dispatchers” may mean operational decision support, customer-email assistance, document processing, knowledge answers, or workflow automation. |
| Known facts | The “Dispečink” app is an in-house .NET Framework 4.8 web app plus Windows service on two on-premises Windows Server 2016 VMs with SQL Server 2016 (~400 GB). It is used by ~150 dispatchers in three shifts, 24/7. It integrates with a telematics provider for ~600 trucks and with Helios ERP. CIO wants to exit the server room by end of next year because the lease ends. Office staff have Microsoft 365 E3; drivers do not have M365 accounts. Delivery capacity: 3 internal developers plus an external partner. |
| Unknowns to discover | Business meaning and priority of “cloud” and “AI”; app criticality and downtime tolerance; rehost vs refactor vs replace; whether a cloud foundation is needed; what internal IT can operate; security/regulatory needs including ADR and possible NIS2 relevance; concrete dispatcher AI scenarios; driver/mobile needs. |
| Colleague hypotheses to verify | After modernization, a managed container-style application platform could fit; a small landing zone/foundation is likely needed; CMR/delivery-note processing may be a quick AI win. These are not facts and must not be presented as recommendations. |
| Interviews | First: head of dispatch / Vedoucí dispečinku, business owner of the app, ~60 minutes, Czech. Later: CIO/IT lead and external development partner. Potential follow-ups: security/compliance or data protection, driver/mobile/process representative. |
| Host | GitHub Copilot app / CLI with file tools; colleague facilitates the session live with the customer. |
| Neutrality | Stay product-neutral with the customer. Azure is likely but not decided. Do not sell or propose products during discovery. |
| Output folder | `./` (this example folder) |

## Phase 2 – scope proposal after colleague adjustment

The colleague confirmed the proposal with these adjustments: keep AI exploratory, not the main focus; make 24/7 operations, downtime tolerance, telematics and ERP integration core; add drivers/mobile use; limit key factors to about 16.

### Solution-shape hypotheses to test

| # | Hypothesis | What the interview must verify |
|---|---|---|
| S1 | Datacenter-exit rehost | Whether the main goal is to move the current app and database out of the server room with minimal change before the lease ends. |
| S2 | Application modernization | Whether the business needs changes in reliability, deployment speed, integration robustness, or scalability that require more than a lift-and-shift move. |
| S3 | Replacement or SaaS/process change | Whether the current Dispečink app is still the right long-term system, or whether parts should be replaced by a packaged or partner solution. |
| S4 | Cloud foundation first | Whether Severka needs a small operating foundation before moving critical workloads, because they have only a trial subscription today. |
| S5 | Dispatcher AI assistance | Exploratory only: which AI-enabled capabilities would actually help dispatchers and where human approval is required. |
| S6 | Document processing quick win | Whether CMR/delivery-note processing is frequent, painful, and independent enough to be a quick pilot. |
| S7 | Driver/mobile extension | Whether drivers need future mobile access, status capture, documents, notifications, or offline capabilities. |

### Discovery areas

| Area | ★ | Name | Goal | Key question themes |
|---|---|---|---|---|
| A | ★ | Business context and success | Understand why now, who owns the outcome, what success means before the lease deadline. | Business trigger, sponsor, measurable success, timeline, budget frame, what cannot fail. |
| B | ★ | Meaning of “cloud” and “AI” / solution shape | Separate datacenter exit, app modernization, foundation, replacement, AI and mobile ambitions. | Open description of target state; rank S1–S7; pilot vs later; explicit out-of-scope. |
| C | ★ | 24/7 dispatch operations and criticality | Map operational reality and business impact of outages. | Shifts, peak periods, manual fallback, delayed dispatch impact, handovers, incident examples. |
| D | ★ | Users, roles and depots | Know who uses or is affected by the solution. | Dispatcher roles, managers, warehouse users, IT/support, external parties, driver population. |
| E | ★ | Dispatch workflows and pain points | Understand daily workflows the app supports and where work is slow, risky or manual. | Last real dispatch case, exception handling, customer communication, dispatcher decisions. |
| F |  | Existing Dispečink application and data | Capture what the business knows about the current app, data and lifecycle. | Critical functions, historical data, retention, data quality, reporting, change frequency. |
| G |  | Telematics, ERP and other integrations | Make integrations a core architecture driver. | Telematics inputs/latency, Helios flows, failures, ownership, manual re-entry, future APIs. |
| H |  | Downtime tolerance, recovery and performance | Discover targets for availability, RTO/RPO, cutover and response times. | Maintenance windows, maximum tolerated outage, data loss, peak users, performance pain. |
| I | ★ | Security, data protection and regulation | Map likely obligations without over-asking the business owner. | Customer data, ADR goods, NIS2 uncertainty, audit, access, approvals, security concerns. |
| J |  | Operations, support and change ownership | Understand who can run and evolve the solution. | Internal IT, dev team, partner, on-call, release process, monitoring, training. |
| K |  | Modernization and migration choices | Prepare later IT/developer discussion without assuming an approach. | Rehost/refactor/replace appetite, cutover constraints, coexistence, testing, rollback. |
| L |  | AI opportunities for dispatchers and documents | Exploratory area; calibrate useful scenarios but do not lead the project from AI. | Route/load suggestions, email/status answers, document extraction, human review, trust. |
| M |  | Drivers and mobile use | Capture possible later driver-facing needs and identity/device constraints. | Driver accounts, mobile devices, offline use, proof of delivery, notifications, language. |
| N |  | Cloud foundation and IT constraints | Mostly for CIO/IT: identify prerequisite platform, connectivity and governance needs. | Subscriptions/environments, identity, network, backup, monitoring, policies, cost. |
| O | ★ | Priorities, pilot and next interviews | Decide what to prove first and who must answer remaining questions. | MVP, pilot depot/team, success criteria, next respondents, top risks and decisions. |

### Key architecture factors

| # | Factor | Why it matters | Primary roles |
|---|---|---|---|
| 1 | Business outcome, owner and lease/timeline pressure | Determines whether speed, risk reduction or transformation dominates. | Head of dispatch, CIO |
| 2 | Solution shape(s) and delivery order | Drives rehost/refactor/replace/foundation/AI sequencing. | Head of dispatch, CIO, external partner |
| 3 | 24/7 availability window and maximum tolerated outage | Drives hosting, deployment, maintenance and HA design. | Head of dispatch, CIO |
| 4 | Recovery targets and tolerable data loss | Drives database, backup and DR choices. | Head of dispatch, CIO, external partner |
| 5 | Dispatch workflow critical paths and peak load | Determines what must be protected first and performance baselines. | Head of dispatch |
| 6 | Current application architecture, dependencies and statefulness | Drives modernization feasibility and migration path. | External partner, CIO |
| 7 | SQL data profile: size, growth, features, retention, reporting | Drives database migration, sizing, cutover and cost. | External partner, CIO/data owner |
| 8 | Telematics and ERP integration pattern, frequency, ownership and failure modes | Drives integration design and operational risk. | Head of dispatch, CIO, external partner |
| 9 | Migration/cutover constraints and coexistence needs | Drives transition design and business risk. | Head of dispatch, CIO, external partner |
| 10 | Security/regulatory baseline: customer data, ADR, possible NIS2, audit | Drives controls, approvals and evidence. | CIO, security/compliance, head of dispatch |
| 11 | Identity and access for dispatchers, IT, partner and possible drivers | Drives access model, accounts and mobile feasibility. | CIO, head of dispatch |
| 12 | Operating model: internal team, partner, support, monitoring, releases | Drives platform complexity that Severka can operate. | CIO, external partner |
| 13 | Cloud foundation, connectivity and environment governance needs | Determines prerequisites before a critical workload can move. | CIO, security/network |
| 14 | AI use cases, value, risk tolerance and human review | Decides if AI is a pilot, later phase or not justified. | Head of dispatch, process owners, CIO |
| 15 | Driver/mobile/offline needs and account/device reality | Influences identity, channels and future extensibility. | Head of dispatch, driver/process representative, CIO |
| 16 | Pilot scope, success criteria, budget frame and decision process | Determines practical next step and architecture depth. | Head of dispatch, CIO |

### Respondent roles and mandatory coverage

| Role | Mandatory areas | Mandatory factors | Shorten / defer |
|---|---|---|---|
| Vedoucí dispečinku / head of dispatch (first session) | A★, B★, C★, D★, E★, F business view, G business impact, H, I★ business concerns, O★; map M if time. | 1, 2, 3, 4 estimate, 5, 8 business impact, 9 cutover impact, 10 business view, 14, 15, 16 | Deep app internals, identity/network, detailed cloud foundation, database features. |
| CIO / IT lead | B, F, G, H, I, J, K, N, O | 1–4, 6–13, 16; validate 14/15 feasibility | Detailed dispatcher workflow examples unless unresolved. |
| External development partner | F, G, H, J, K, L feasibility | 2, 4, 6, 7, 8, 9, 12, 14 | Business case, budget politics, regulatory interpretation. |
| Security/compliance/DPO | I, N security parts, O risks | 10, 11, 13, 14 risk/human review | Deep app code, dispatch operations beyond examples. |
| Driver/mobile/process representative (if invited) | D, E driver touchpoints, M, O | 5, 11, 15, 16 | Cloud foundation, database, app internals. |

### Inspiration card titles

1. Staged move out of the server room without losing dispatch continuity.
2. Dispatch exception board for live operational risks.
3. Safer shift handover with a concise operations summary.
4. Integration health monitor for telematics and ERP flows.
5. Customer status-answer assistant for shipment enquiries.
6. CMR and delivery-note pre-processing with human check.
7. Driver mobile capture for proof of delivery and incidents.
8. Dispatcher suggestion support for routes, capacity and constraints.

### Ambiguities to resolve early

| Ambiguity | Why it matters | Early resolution approach |
|---|---|---|
| “Cloud” | Could mean minimal hosting move, modernization, replacement, or foundation. | Ask what users and IT should be able to do when the project is finished; then rank solution-shape hypotheses. |
| “AI for dispatchers” | Could be decision support, customer communication, document extraction, or not valuable. | Keep exploratory; offer examples only after current process and priorities are understood. |
| “Critical app” | “24/7” may still allow planned windows or may mean near-zero downtime. | Ask for last outage, tolerated outage by time of day, manual fallback and business impact. |
| Integration scope | Telematics and Helios may be batch, API, file or custom integration with different owners. | Ask business impact first; defer technical protocol details to CIO/partner. |
| Regulatory scope | ADR and possible NIS2 may or may not create specific controls. | Record uncertainty; ask who decides and what audits/policies already exist. |
| Driver/mobile later | Future driver access may affect identity and channels even if not first release. | Map order of magnitude and must-have vs later; create follow-up questions for IT/driver representative. |

## Design decisions

- The generated prompt is entirely in Czech because all planned interviews are in Czech.
- The first session is optimized for the head of dispatch and a 60-minute facilitated conversation; IT/developer/security details are converted into open questions instead of forcing the business respondent to answer them.
- AI is intentionally an exploratory area, not the main organizing theme. It appears in solution-shape ranking and inspiration cards, but the core first-session flow emphasizes 24/7 dispatch, downtime, workflows, data and integrations.
- The term “Azure” and specific cloud services are not used as recommendations in the generated customer-facing prompt. Existing Microsoft context is listed only as known context.
- The prompt assumes file tools are available, so it requires saving `CONVERSATION.md` and `REQUIREMENTS.md`; the no-file-tools fallback was removed.
- Core (★) areas were reduced from 11 to 7 (A–E, I, O) so that a 60-minute first session can map them; F, G, and H remain mandatory for the head of dispatch at the business level through the coverage check.
- The discovery areas were kept to 15 and key factors to 16 to fit the skill’s compact-scope guidance and the colleague’s requested limit.
- Drivers/mobile were added as a distinct area and factor because later driver-facing features could change identity, device, offline and channel design even if they are not the first pilot.
