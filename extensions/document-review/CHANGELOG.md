# Changelog

## 2.0.0

- Optional click/keyboard image review for images, SVGs and explicitly marked
  CSS visuals; text review and normal document navigation remain available.
- Durable immutable candidates with image hashes, source revisions,
  crop/composition metadata, parents, generation/request IDs, favorites and
  comment history. Version-one text records migrate on the next successful
  write without discarding history.
- Preview-only original/candidate comparison in the same HTML slide, large
  view and original-image gallery. No per-variant presentation files.
- Explicit queued image-edit, bounded generation, crop/layout-only and
  use-candidate requests. Generation outcomes require registered outputs;
  source-edit outcomes require a changed source hash.
- Offline fictional fixture and expanded server/browser regression tests.
