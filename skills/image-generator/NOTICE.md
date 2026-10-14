# Provenance

This is a clean, portable MIT adaptation of the optional image-authoring
workflow inspected at `D:\presentations\.agents\skills\image-generator`.
Its skill metadata declares **MIT** and identifies Tomáš Kubica's
`tkubica12/presentation-forge` distribution and the original
`tkubica12/image-generator-skill` project. The inspected package version was
**0.1.0**. No standalone LICENSE file was present in that local package;
the declared MIT notice and this repository's Tomáš Kubica MIT license are
preserved by the package's [LICENSE](LICENSE).

Read-only inspection covered the source adapters, authentication, configuration,
runner, skill instructions, dependency manifest/lock and the original
`test_config_and_backends.py`. The original workflow informed the brief,
variation/reference support and Azure Entra adapters. This implementation is
rewritten; it does not copy source virtual environments, compiled Python files,
environment files, private caches/configuration, or the original public-PyPI
lock. The original source checkout and its lock were not changed.

Version 0.2.0 removes the original deployment/chat defaults, deployment-name
backend inference, size clamping/snapping, automatic reference downscaling and
filename-only prompt/image reuse. Current API capability differences were
checked against official Azure documentation; see
[API_EVIDENCE.md](references/API_EVIDENCE.md).
