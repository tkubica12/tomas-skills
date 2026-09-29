# Topic catalog for discovery interviews

A menu, not a checklist. Use it to propose a scope to the colleague, then
select, merge, rename, and add topics for the specific customer. Most real
projects combine two or three modules. Keep the generated prompt within
12–18 areas and 12–20 key factors: merge related topics rather than listing
everything.

The interviewer stays product-neutral with the customer by default. The
"informs" notes below are for the account team: they explain which design
choices a factor drives, so the colleague can judge whether it matters. Do not
copy product names into a neutral prompt.

## Contents

- [Universal areas](#universal-areas)
- [Universal architecture factors](#universal-architecture-factors)
- [Project-type modules](#project-type-modules)
- [Roles](#roles)
- [Writing good questions and cards](#writing-good-questions-and-cards)

## Universal areas

Almost every discovery needs these. Mark the business-facing ones ★ (core of
the first session).

| Area | Goal | Question ideas |
|---|---|---|
| ★ Context and motivation | Why now, what success is | Problem or opportunity; trigger (acquisition, audit, regulation, end of support, leadership initiative); sponsor, decision maker, owner; measurable success in a year; timeline; budget order of magnitude |
| ★ Solution shape | Which meaning of the request applies, in what order | Ask openly first ("when it is finished, what do people do with it?"), then offer the plausible shapes as options; rank by value and by delivery order; what is explicitly out of scope |
| ★ Users and organization | Who, how many, which roles | Units/companies involved now vs later; separation or sharing between them; roles and counts; external users; languages |
| ★ Data | What is stored or processed | Where it lives today; migration vs new only; volumes and counts; formats; growth; sensitivity; quality; a **minimum data profile** of the few numbers that drive cost and design |
| ★ Lifecycle and change | How content, data, or workloads are created, changed, retired | Ingestion path; frequency of changes; versioning; approval states; retention and deletion; required freshness |
| Access and sharing | Permission model | What determines access (unit, project, role, classification, attributes, time); granularity; who grants; how often it changes; external sharing; audit; recertification; how fast revocation must take effect everywhere |
| Experience and channels | Where people will work | Tools used today and what they like or dislike; familiar tools vs dedicated app; self-service expectations; mobile, offline |
| Integrations | Systems in and out | Source and target systems; external data sources; one-off vs continuous; volumes; owners |
| ★ Security, data protection, regulation | Rules the solution must satisfy | Applicable regulations; data residency; encryption and key ownership; policies for AI or cloud services and who approves; classification labels; data loss prevention; security approval, penetration tests; legal hold, e-discovery |
| Existing IT environment (mostly IT) | Constraints and assets | Identity (cloud, on-premises, hybrid, several directories, external identities); number of tenants/environments; licensing; cloud foundation and its rules; existing systems to replace or integrate (version, support end, export options); monitoring, backup, device management; private connectivity requirements; SaaS vs custom preference; internal team vs partner |
| Non-functional requirements | Service levels | Availability window; tolerable outage; recovery point and time; concurrent users; response times; scaling; support hours and language |
| Operations and lifecycle of the solution | Who runs and evolves it | Owner and operator; onboarding new units or use cases centrally or self-service; cost allocation; adoption and training; how quality is measured over time and by whom |
| ★ Priorities, pilot, next steps | What first, what proves value | Highest-value scenario; pilot scope, team, date; what the pilot must prove; top risks and concerns; who to invite next |

## Universal architecture factors

Pick those that matter; phrase them in the customer's terms.

1. Solution shape(s) and their order
2. Organizational scope: units/companies, separation, information barriers
3. External users: yes/no, count, access pattern
4. Identity model: single vs multiple directories, cloud vs on-premises vs hybrid, guests
5. Number of tenants or environments and whether that can change
6. Permission granularity and change rate; required propagation speed
7. Data volume, count, formats, languages, sensitivity
8. Change rate and required freshness
9. Preferred channels: familiar tools vs dedicated application
10. Integrations and their direction and frequency
11. Regulation, residency, encryption and key ownership, policies for AI or cloud
12. Audit and traceability requirements
13. Licensing and existing systems (keep, replace, integrate)
14. SaaS vs custom build preference; who builds, operates, and evolves
15. Availability, recovery, and performance targets
16. Pilot: scope, date, success criteria
17. Budget order of magnitude and cost-allocation model

## Project-type modules

Each module lists signals, extra topics, factors, card ideas, and specialist
roles. The "informs" line is for the account team only.

### Knowledge, search, and AI answers over content

- **Signals:** "AI over our documents", "chat with our data", "find anything",
  "a company brain", intranet search, knowledge base.
- **Topics:** 3–5 real questions people would ask; answer vs search vs
  summarize/compare/extract to table/translate/draft; citations to exact
  places; scope of search (one unit vs whole organization, always
  permission-trimmed); accuracy expectations and what is worse (miss vs wrong);
  behavior when unsure; images, charts, tables in content; combining with
  e-mail, systems, public registers, web.
- **Factors:** content locations and formats; permission trimming and
  revocation speed; freshness after upload or change; languages; citation
  requirement; quality measurement (test questions, feedback) and owner.
- **Cards:** group memory with answers only from what the user may see;
  executive summaries across reports with source links; comparing a new
  contract with a template.
- **Informs:** SaaS (SharePoint, Microsoft 365 Copilot, Copilot Studio) vs PaaS
  retrieval (Microsoft Foundry, Foundry IQ knowledge bases, Azure AI Search),
  document-level security trimming, indexing cadence, multimodal extraction.
- **Roles:** key users, content owners, IT (identity, tenants, licenses),
  security (AI policies).

### Content as a building block for other AI solutions

- **Signals:** "other teams will build agents", "we want a platform", "connect
  it to our assistant".
- **Topics:** planned assistants and agents (own and vendor); may users connect
  it themselves or only approved applications; on behalf of the user vs
  system/unattended scenarios; who builds consumers (developers, partners,
  citizen developers); existing enterprise assistant.
- **Factors:** consumer types and count; delegated user identity vs service
  identity; governance of who may connect; standard interface expectations.
- **Cards:** one prepared and secured knowledge source that other assistants
  plug into without each team building its own.
- **Informs:** exposing retrieval as a tool/API (for example an MCP server),
  on-behalf-of authentication, API management, agent registry and governance.
- **Roles:** enterprise architect, developer leads, security.

### Document processing and extraction

- **Signals:** invoices, contracts, forms, receipts, product sheets, "extract",
  "classify", "fill our system from PDFs".
- **Topics:** document types and volumes per type; classification and taxonomy
  (exists or must be created); fields to extract per type; summarization,
  translation, redaction, version comparison; who defines new types and rules
  (IT vs business self-service; global vs per unit); required accuracy and
  human review (always, sampled, on low confidence); reprocessing history when
  rules improve; where extracted data goes.
- **Factors:** document mix and scan quality; per-type accuracy targets;
  human-in-the-loop design; rule ownership model; downstream systems.
- **Cards:** automatic filing with type, unit, confidentiality, and key
  metadata; contract watcher for renewal and notice periods; invoice intake.
- **Informs:** Azure Content Understanding / Document Intelligence vs
  LLM-based extraction, SharePoint content processing, review UI, schema
  management.
- **Roles:** process owners, key users (accounting, legal), data owners.

### Agents, workflow, and process automation

- **Signals:** "automate approval", "the AI should act", "reply to the
  supplier", "prepare the case for a human".
- **Topics:** 1–2 most painful document- or event-driven processes (trigger →
  steps → decisions → output); autonomy level (prepare, recommend, act within
  limits); determinism vs free research steps; who defines and changes
  processes (developers, analysts, business by clicking); testing and approval
  of changes; audit of who decided what and why (human and AI); notifications,
  reporting; accountability and error tolerance.
- **Factors:** autonomy and risk limits; deterministic workflow vs agentic
  research; low-code vs pro-code ownership; observability, evaluation, and
  audit; human-in-the-loop points.
- **Cards:** invoice intake with automatic checks and supplier queries;
  counterparty research from public registers with sources for human review;
  completeness check of a document set.
- **Informs:** Copilot Studio / Power Automate / Logic Apps vs Microsoft Foundry
  Agent Service and workflows, durable orchestration, evaluation and tracing,
  approval patterns.
- **Roles:** process owners, operations, risk/compliance, developers.

### Custom applications and modernization (AKS, Container Apps, App Service)

- **Signals:** "move our app to the cloud", "containers", "Kubernetes",
  "modernize", "new portal", "SaaS product".
- **Topics:** applications in scope and their business criticality; current
  architecture, languages, frameworks, dependencies; statefulness and data
  stores; traffic patterns, peaks, and growth; multi-tenancy for external
  customers; release frequency and deployment process; team skills and size;
  operational maturity (on-call, observability); build vs rehost vs refactor
  appetite; licensing and third-party components; end-of-support dates.
- **Factors:** workload profile and scale; state and data; team skills and
  operations model; release cadence; isolation and tenancy; portability or
  Kubernetes requirements; compliance for hosting.
- **Cards:** zero-downtime releases several times a day; scale to zero for
  seasonal apps; a self-service platform for internal teams.
- **Informs:** Azure Container Apps vs AKS vs App Service, managed data
  services, platform engineering, CI/CD approach.
- **Roles:** application owner, development lead, operations/SRE, security.

### Azure landing zone, platform, and infrastructure

- **Signals:** "landing zone", "cloud foundation", "we start with Azure",
  "datacenter exit", "migrate VMs".
- **Topics:** workloads expected in the next 12–24 months and their
  classification; organizational structure for subscriptions and management
  groups; environments; network topology, hybrid connectivity, internet egress,
  inspection; DNS; identity and privileged access; policy and compliance
  baseline; security monitoring; backup and DR; cost management and chargeback;
  automation and infrastructure as code; operating model and responsibilities
  (central platform team vs application teams); existing on-premises estate and
  migration waves.
- **Factors:** workload portfolio; regulatory baseline and residency;
  connectivity and network security model; identity and privileged access;
  operating model; IaC and change process; scale of subscriptions and teams.
- **Cards:** new team gets a compliant environment in hours; guardrails that
  prevent misconfiguration instead of audits after the fact; transparent cost
  per team.
- **Informs:** Azure landing zone reference choices (hub-spoke vs Virtual WAN,
  management group design, Azure Policy baseline, Defender for Cloud, Sentinel,
  Azure Verified Modules).
- **Roles:** infrastructure architect, network, security, identity, finance/FinOps.

### Databases and data migration

- **Signals:** "SQL Server end of support", "Oracle licensing", "move our
  databases", "high availability".
- **Topics:** engines, versions, count, sizes, growth; application
  compatibility and features used; HA/DR today and targets; maintenance and
  cutover windows; performance baselines; licensing; data sensitivity;
  dependencies between databases and apps; team skills.
- **Factors:** engine and feature compatibility; size and change rate;
  downtime tolerance; HA/DR targets; licensing position.
- **Cards:** migration with minutes of downtime; automatic patching and
  backups; reporting replicas without affecting production.
- **Informs:** Azure SQL Managed Instance vs Azure SQL Database vs SQL on VMs,
  PostgreSQL flexible server, Azure Database Migration Service, Azure Hybrid
  Benefit.
- **Roles:** DBAs, application owners, infrastructure.

### Data, analytics, and Microsoft Fabric

- **Signals:** "single source of truth", "reporting", "data platform", "Power
  BI is slow", "data lake", "Fabric".
- **Topics:** key decisions and reports; data sources, volumes, latency needs
  (batch vs near real time); data quality and ownership; domains and
  self-service vs central team; semantic models and KPI definitions; governance
  and catalog; consumers (analysts, executives, external); AI and ML use of
  data; existing tools and skills; capacity and cost expectations.
- **Factors:** source landscape and latency; domain ownership model; governance
  and lineage; consumer count and concurrency; security model (row/object
  level); skills.
- **Cards:** the same KPI numbers in every report; business users asking data
  questions in plain language; alerts on anomalies.
- **Informs:** Microsoft Fabric workloads (OneLake, lakehouse, warehouse,
  real-time intelligence), Power BI, Microsoft Purview, Azure Databricks.
- **Roles:** data owners, BI lead, data engineers, finance/controlling.

### Microsoft 365 and SaaS-first collaboration

- **Signals:** "SharePoint", "Teams", "Copilot for everybody", "file servers",
  "external sharing".
- **Topics:** tenants and mergers; file server and legacy DMS migration;
  information architecture; external collaboration and guest policies;
  sensitivity labels and DLP; retention; Copilot readiness (oversharing);
  licensing mix.
- **Factors:** tenant model; licensing (E3/E5, Copilot); labeling maturity;
  oversharing risk; migration source systems.
- **Cards:** secure external collaboration spaces with expiry; Copilot that
  never shows what the user must not see.
- **Informs:** SharePoint Online, Teams, SharePoint Advanced Management,
  Microsoft Purview, Microsoft 365 Copilot, cross-tenant options.
- **Roles:** M365 administrator, security/compliance, records management.

### GitHub, DevOps, and developer platform

- **Signals:** "GitHub Enterprise", "Copilot for developers", "migrate from
  Azure DevOps / GitLab / Bitbucket", "inner source", "secure supply chain".
- **Topics:** teams, repositories, languages; current SCM and CI/CD; branching
  and release process; security scanning and compliance needs; runners and
  network constraints; identity and enterprise managed users; inner source;
  developer productivity goals and metrics; AI coding assistant policy.
- **Factors:** scale of organizations and repos; compliance and data residency;
  identity model (EMU vs standard); runner hosting; migration scope.
- **Cards:** security findings fixed in the pull request; a golden path from
  idea to production in a day; measurable productivity uplift.
- **Informs:** GitHub Enterprise Cloud (with data residency), EMU, GitHub
  Advanced Security, Actions runners, GitHub Copilot, migration tooling.
- **Roles:** engineering managers, DevOps/platform team, security.

### Security operations and identity

- **Signals:** "SIEM", "SOC", "Zero Trust", "identity consolidation".
- **Topics:** current tools and coverage; log sources and volumes; incident
  process and staffing; identity sources and consolidation; privileged access;
  compliance frameworks (for example NIS2, DORA, ISO 27001).
- **Factors:** log volume and retention; SOC operating model; identity
  topology; regulatory frameworks.
- **Informs:** Microsoft Sentinel, Defender XDR, Entra ID governance and
  privileged identity management.
- **Roles:** CISO, SOC lead, identity team.

## Roles

| Role | Typically knows | Typically does not know |
|---|---|---|
| Business owner / sponsor | Motivation, success, users, scenarios, priorities, budget frame | Identity, network, licensing details |
| Key user / process owner | Real tasks, examples, pain points, data and documents, process steps | Platform and security details |
| IT architect / CIO / infrastructure | Identity, tenants, licensing, cloud foundation, existing systems, operations | Business priorities, detailed processes |
| Security / compliance / DPO | Regulation, policies, classification, audit, AI approval | Business scenarios |
| Development lead | Application architecture, skills, release process | Business case, licensing |
| Data owner / BI lead | Data sources, quality, definitions, consumers | Infrastructure |

Mandatory areas per role in the generated prompt must reflect this: do not
make the business owner answer identity questions; do make the IT respondent
cover licensing, labels, AI or cloud policies, and legacy systems (these were
skipped in rehearsals when not explicitly required).

## Writing good questions and cards

- Business language first; explain a technical term in one sentence once.
- Ask for the last real example rather than a general description.
- Numbers as orders of magnitude; say that estimates are fine.
- Offer "I don't know – who would?" as a normal answer.
- Cards: 2–3 sentences, the customer's domain, a visible benefit, no product
  names, a range from modest to ambitious so reactions calibrate ambition.
