# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-08-20

Initial release. API contract pinned from **sysadminsmedia/homebox v0.26.2**
(commit `e01dd737238a3fa7e1a6454b37de6c6fc88c86e4`, spec fetched 2026-08-20
from a live instance; see `docs/homebox-openapi.json`).

### Added

- `HomeboxApi` credential: base URL + API key (`Authorization: Bearer`),
  self-signed-certificate toggle, credential test against `/api/v1/users/self`.
  Username-and-password login deliberately unsupported.
- **Homebox** node with resources Item, Location, Tag, Attachment,
  Maintenance and Group over the v0.26 entities API; usable as an AI tool.
- Read-merge-write on every update (the Homebox PUT endpoints are full
  replaces — verified live); unspecified fields, tags, location, custom
  fields and warranty data are preserved.
- Location dropdowns with full tree paths; tag multi-selects with parent
  chains; item picker with From list / By ID / By asset ID modes.
- Attachment upload/download with hand-built multipart (zero runtime
  dependencies) and n8n binary data on both directions.
- CSV export operation; CSV import deliberately excluded.
- **Homebox Trigger** polling node: new item, new item in location,
  item updated, warranty expiring (CSV-export-backed), maintenance due.
- GitHub Actions CI and npm-provenance publish workflows (n8n requires
  provenance publishing since 2026-05-01).
