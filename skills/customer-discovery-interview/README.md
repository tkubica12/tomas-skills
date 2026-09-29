# Customer discovery interview

Prepare a tested interview prompt for a customer project. Tell the agent what
the project is, what you already know, and what you think must be found out.
The skill agrees the discovery scope with you, generates `PROMPT.md` for your
customer, rehearses it with two simulated participants, and fixes what the
rehearsal exposes.

The generated prompt lets an AI interviewer talk to the customer's business
owner, then IT, security, or other specialists, in their language. It keeps:

- `CONVERSATION.md`: a clean, rewritten record of every session;
- `REQUIREMENTS.md`: a living specification with stable IDs, key factors for
  the architecture design, and open questions assigned to the roles that
  should answer them.

Running the same prompt again with another person continues where the last
session stopped. The result is the input for designing an architecture,
typically on Microsoft cloud (Azure, Microsoft Foundry, Microsoft 365, Fabric,
GitHub), without the interviewer pitching products.

## Try it

> Use customer-discovery-interview. Our customer, a regional logistics company,
> wants to "move the dispatch application to the cloud and maybe add AI for
> dispatchers". We know it is a .NET application on two on-premises servers
> with SQL Server, about 150 dispatchers, and the CIO wants to leave the
> datacenter by the end of next year. We need to find out what the business
> expects, how critical the app is, and what their IT can operate. The first
> interview is with the head of dispatch, in Czech. Save the output to
> `discovery\`.

See the [example](https://github.com/tkubica12/tomas-skills/blob/main/examples/customer-discovery-interview/README.md):
the intake, generated prompt, rehearsal transcript, outputs, and test report.

## What it covers

The [topic catalog](references/topic-catalog.md) suggests areas and
architecture factors for AI search and knowledge, document processing, agents
and workflow, custom applications on AKS or Container Apps, landing zones and
infrastructure, databases, analytics and Fabric, Microsoft 365, GitHub and
DevOps, and security operations. It is a starting point: the agent composes
the scope with you rather than applying a fixed questionnaire.

## Requirements

- An agent host with file tools to write the prompt and rehearsal outputs.
- For the rehearsal, a host that can run two multi-turn subagents and relay
  messages (for example GitHub Copilot app or CLI). Fallbacks are described in
  [references/testing.md](references/testing.md).
- The generated prompt runs best in an agent with file tools. It includes a
  fallback that prints both files in chat when files cannot be written.

No scripts or dependencies. Rehearsal outputs contain simulated answers; do not
send them to the customer.
