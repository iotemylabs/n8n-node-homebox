# @iotemy/n8n-nodes-homebox

An n8n community node for [Homebox](https://homebox.software), the self-hosted home inventory and organisation system. **This package targets the [sysadminsmedia/homebox](https://github.com/sysadminsmedia/homebox) fork, v0.26.x** — the version family that unified items and locations into the entities API and renamed labels to tags. It will not work against the original, unmaintained `hay-kot/homebox`, whose API differs substantially. The pinned OpenAPI contract this package was built and tested against lives in [`docs/homebox-openapi.json`](docs/homebox-openapi.json).

Two nodes are included:

- **Homebox** — items, locations, tags, attachments, maintenance and group statistics. Usable as an AI agent tool.
- **Homebox Trigger** — new item, item updated, warranty expiring, maintenance due, new item in location. Homebox has no outgoing webhooks, so this is a polling trigger.

## Installation

For self-hosted n8n: **Settings → Community Nodes → Install**, enter `@iotemy/n8n-nodes-homebox`, and confirm. Or from the n8n container/host:

```bash
npm install @iotemy/n8n-nodes-homebox
```

then restart n8n. See the [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

## Credentials

The package authenticates with a **Homebox API key** and nothing else.

1. In Homebox, open **Profile → API Keys** and create a key (Homebox keys start with `hb_`). Keys can optionally carry an expiry date; without one they live until revoked.
2. In n8n, create a **Homebox API** credential:
   - **Base URL** — the root URL of your instance (e.g. `https://homebox.example.com`). Do not append `/api`; the node does that itself and rejects URLs that already include it.
   - **API Key** — the key from step 1.
   - **Ignore SSL Issues** — enable for self-signed certificates.
3. Saving the credential runs a real test call against `GET /api/v1/users/self`.

**A note on scope:** Homebox API keys are not scoped — a key grants the same access as the account that created it. Treat it like a password.

**Why no username-and-password login?** Deliberately unsupported, and this is not revisited per-workflow:

- API keys are long-lived and stateless — no token refresh, no mid-workflow expiry, no login round-trip on every execution.
- n8n credentials are configuration, not runtime state. A login flow yields an expiring bearer token that has nowhere sound to live in a credential, and the credential test could never exercise a value that only exists mid-run.
- A key is revocable on its own, without changing the account password or logging out browser sessions.

If your Homebox is too old to offer API keys, upgrade Homebox rather than looking for a login fallback here.

## Data safety: updates are read-merge-write

In this Homebox version, the item update endpoint is a **full replace**: a PUT carrying only a name wipes the description, clears the location and strips every tag (verified against a live instance during development). This package therefore never sends partial PUTs. Every update operation first reads the current object, merges your changes on top, and writes the complete payload back — **fields you don't set are preserved**, including tags, location, custom fields and warranty data. The same rule is applied to tag, attachment-metadata and maintenance updates, whose endpoints behave the same way.

## Archived items

Homebox excludes archived items from every list by default. All list operations expose an **Include Archived** toggle so that half your inventory can't silently disappear from a workflow.

## Trigger node (polling — there are no webhooks)

Homebox has no outgoing webhook or event-subscription mechanism, so the trigger polls on the schedule you configure in n8n.

| Event | How it works |
|---|---|
| New Item | Watches the item list sorted by creation time; each new item is emitted as its own n8n item |
| New Item in Location | Same, scoped to selected locations (optionally their whole subtree) |
| Item Updated | Watches the update timestamp; freshly created items are excluded (creation also bumps it) |
| Warranty Expiring | Reads the CSV export once per poll (warranty dates aren't in list responses) and emits items whose warranty expires within the window — each item/expiry once |
| Maintenance Due | Watches scheduled maintenance entries due within the window; overdue entries are flagged `overdue: true` |

The first poll emits nothing — it records a watermark so only later changes trigger. Manual executions ("Fetch Test Event") return a real sample so you can build against live data.

## Operations

| Resource | Operations |
|---|---|
| **Item** | Get, Get Many (search, tag/location/photo/custom-field filters, include-archived, sort), Create, Update, Delete, Get Path, Duplicate, Archive, Unarchive, Export CSV |
| **Location** | Get, Get Many, Get Tree, Get Items (optionally whole subtree), Get Path, Create, Update, Delete |
| **Tag** | Get, Get Many, Get Items, Create, Update, Delete |
| **Attachment** | Get Many (of an item), Upload (from binary data), Download (to binary data), Update (title/type/primary), Delete |
| **Maintenance** | Get Many (of an item), Get Many (Group), Create, Update, Delete |
| **Group** | Get, Get Statistics (totals, by location, by tag, price over time), Get Invitation Token |

Details worth knowing:

- **Item pickers** offer *From List* (live search), *By ID*, and *By Asset ID* (the `000-042`-style IDs Homebox prints on labels).
- **Location dropdowns show the full path** (`Garage → Shelf B → Bin 3`), built from the location tree — never a bare leaf name.
- **Tags are multi-select dropdowns**, shown with their parent chain; never free-text ID lists.
- **Item Create** accepts the full field set: Homebox's create endpoint only takes name/description/location/quantity/tags, so the node applies anything else you set with an immediate merged follow-up update.
- **Deletes are irreversible** and say so in the UI. Deleting a *location* does **not** delete what's inside it, but everything inside loses its place in the tree. Deleting an *item* also deletes its attachments, custom fields and maintenance log. Deleting a *tag* leaves items intact.
- **Maintenance has no single-entry Get** — the Homebox API doesn't offer one; use the Get Many operations.
- **Attachment upload builds its multipart body by hand** — the package has zero runtime dependencies (an n8n verification requirement).

### Deliberately out of scope in v1

- **CSV import** — a malformed import is very hard to unwind; export is supported, import is not.
- **User and group-membership management** (registration, invitations acceptance, member removal).
- **Bulk maintenance actions** (`/actions/*`, including wipe-inventory), notifiers, entity-type/template management, label-printing and barcode helpers.

## Worked examples

### Weekly warranty report

Every Monday morning, one message listing everything whose warranty expires in the next 30 days:

1. **Homebox Trigger** — Event: *Warranty Expiring*, Window: 30 days. Set the polling schedule to weekly (Mon 08:00).
2. Each expiring item arrives as its own n8n item: `name`, `location`, `warrantyExpires`, `daysUntilExpiry`, `assetId`, `id`.
3. Aggregate them (e.g. the **Summarize** node, or an Item Lists → Concatenate) into one list.
4. Send it anywhere — e.g. a **Send Email** or messenger node: `{{ $json.name }} ({{ $json.location }}) — expires {{ $json.warrantyExpires }} ({{ $json.daysUntilExpiry }} days)`.

### Auto-attach the manual when a new item is added

1. **Homebox Trigger** — Event: *New Item*, polling every 15 minutes.
2. **HTTP Request** — search for a PDF manual, e.g. `https://duckduckgo.com/html/?q={{ $json.name }} manual filetype:pdf` (or a manuals API of your choice), follow the first result and download the PDF as binary data.
3. **Homebox** node — Resource: *Attachment*, Operation: *Upload*, Item: `{{ $('Homebox Trigger').item.json.id }}` (By ID), Input Binary Field: `data`, Type: *Manual*.
4. The manual is now attached to the item in Homebox, typed as a manual.

## Development

```bash
npm install
npm run lint
npm run build
```

Releases are published **via GitHub Actions with an npm provenance statement** (`.github/workflows/publish.yml`) — since 1 May 2026, n8n does not verify community nodes published from a local machine. `npm run release` locally lints, builds, bumps, tags and pushes; the tag triggers the provenance publish.

The API contract this package is generated from is pinned in [`docs/homebox-openapi.json`](docs/homebox-openapi.json) and summarised in [`docs/API.md`](docs/API.md); it is never re-fetched at build time.

## License

[MIT](LICENSE)
