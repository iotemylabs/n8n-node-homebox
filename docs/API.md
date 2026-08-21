# Homebox API — pinned contract for @iotemy/n8n-nodes-homebox

| | |
|---|---|
| **Fork** | `sysadminsmedia/homebox` (confirmed — the `hay-kot/homebox` lineage ended long before this API shape existed) |
| **Version** | `v0.26.2`, commit `e01dd737238a3fa7e1a6454b37de6c6fc88c86e4` |
| **Spec** | Swagger 2.0, fetched from `http://<instance>/swagger/doc.json` on **2026-08-20**, pinned verbatim in [`homebox-openapi.json`](homebox-openapi.json) |
| **Base path** | `/api` (node joins `baseUrl + /api/v1/...`) |
| **Docs UI** | `/swagger/index.html` (also `/swagger`, `/docs`); `/api/v1/docs` does **not** exist |

> **The API restructured in this version.** There are no `/v1/items`, `/v1/locations`, or `/v1/labels` routes.
> Everything is an **entity** (`/v1/entities`); an entity is a *location* when its entity type has
> `isLocation: true`, otherwise it is an *item*. Nesting (location tree **and** item-in-location) is one
> `parentId` edge. **Labels are now tags** (`/v1/tags`, attached via `tagIds` on the entity). The node keeps
> the familiar Item / Location / Tag resource split on top of this, using the `isLocation` filter.

---

## Phase 0 findings (each one changed the node design)

1. **API keys — supported, first-class.** Created in the Homebox UI (Profile → API Keys; API: `POST /v1/users/self/api-keys`). Sent as `Authorization: Bearer <key>` (keys look like `hb_…`; the server also accepts the raw key without the `Bearer ` prefix — the node always sends `Bearer`). Verified live: 200 with key, 401 without. Keys carry **no scopes** — a key has the full access of the user who created it. Keys **may** carry an optional `expiresAt` (nullable → non-expiring). Never sent as a query parameter. On the wire an API key is interchangeable with a session token (same header, same middleware); the difference is lifetime and revocability (`DELETE /v1/users/self/api-keys/{id}`).
2. **Locations are a tree.** Both a flat list (`GET /v1/entities?isLocation=true`) and a tree (`GET /v1/entities/tree`, recursive `{id, name, type: location|item, children[]}`) exist. An entity's location is a **direct `parentId`**, not a path. `GET /v1/entities/{id}/path` returns the full ancestor path. The location dropdown is built from the tree so it shows `Garage → Shelf B → Bin 3`.
3. **Tags (labels) are many-to-many** via `tagIds` on the entity payload — there are no attach/detach endpoints. **`PUT` with a missing/partial `tagIds` replaces the whole set** (verified live: naive PUT stripped all tags). `PATCH` treats `tagIds: null`/absent as *leave alone* and a non-null array as *replace exactly* (verified in source). Tags themselves nest (`parentId` on the tag).
4. **Item update: PUT is a full replace — verified live against a real item.** A PUT carrying only `{id, name}` wiped the description, **cleared the item's location (parent)**, and stripped all tags. Omitted date fields are actively cleared to NULL. The node therefore does **read-merge-write** for every update, in one place (`GenericFunctions.ts`). `PATCH /v1/entities/{id}` is a true partial merge but only covers `quantity`, `parentId`, `entityTypeId`, `tagIds`.
5. **Attachments are multipart.** `POST /v1/entities/{id}/attachments`, `multipart/form-data` with fields `file` (required), `name` (required), `type` (optional), `primary` (optional). Type enum: `attachment` (default), `photo`, `manual`, `warranty`, `receipt`, `thumbnail`. Download: `GET /v1/entities/{id}/attachments/{attachment_id}` → `application/octet-stream`. Metadata update: `PUT` with `{title, type, primary}`. There is **no attachment list endpoint** — the list comes embedded in the entity (`EntityOut.attachments`, with `id`, `title`, `type`, `mimeType`, `primary`, timestamps).
6. **Maintenance is a child resource.** `GET|POST /v1/entities/{id}/maintenance` plus group-wide `GET /v1/maintenance`, both with `?status=scheduled|completed|both`. Entries carry `name`, `description`, `cost` (a **string**, e.g. `"0"`), `completedDate`, `scheduledDate`. Update/delete by entry id (`/v1/maintenance/{id}`). **There is no single-GET for one maintenance entry** — the node's Maintenance resource has no `get` operation (documented, not invented). **Maintenance PUT is also an unconditional full replace** (verified in source: all five fields `Set…` from the payload) — the node merges from the group-wide list (entries carry their `id` there) before writing.
7. **Custom fields — yes.** `fields[]` on the entity: `{name, type: text|number|boolean|time, textValue, numberValue, booleanValue}`. Field-name discovery: `GET /v1/entities/fields`; known values for one field: `GET /v1/entities/fields/values?field=…`. Custom fields ride on the full `PUT` payload → covered by read-merge-write.
8. **Pagination & search.** `GET /v1/entities` takes `page`/`pageSize` (server default: everything when unset) and returns `{items, total, page, pageSize, totalPrice}`. Search/filter params — several are implemented by the handler but **missing from the swagger annotations** (verified in backend source at the pinned commit, marked `source:true` in [`api-inventory.json`](api-inventory.json)): `q` (a `q` starting with `#` is an asset-ID lookup), `tags` (repeatable), `negateTags`, `parentIds` (repeatable), `filterChildren` (true = only root entities with no parent), `isLocation`, `includeArchived`, `onlyWithPhoto`, `onlyWithoutPhoto`, `fields` (repeatable `name=value` custom-field filters), `orderBy` (`name` | `createdAt` | `updatedAt` | `assetId`; the date orders sort descending — this is what makes cheap trigger polling possible).
9. **Archived items are excluded from lists by default** (verified live). `includeArchived=true` restores them; the node exposes the toggle prominently on every item list. There are no dedicated archive endpoints — `archived` is a boolean on the update payload, so Archive/Unarchive are merged PUTs.
10. **Response envelopes.** Lists of entities: `{items, total, page, pageSize, totalPrice}`. Tags, tree, maintenance, entity-types: bare arrays. Single objects: bare. `GET /v1/users/self`: wrapped as `{item: {...}}`. Writes return the full updated object (201/200); deletes return 204 with no body. All variants unwrapped in one place.
11. **Import/export.** CSV export: `GET /v1/entities/export` (text; header row uses `HB.*` columns incl. `HB.warranty_expires`, `HB.location` as a ` / `-joined path, `HB.tags` `; `-joined, `HB.field.*` per custom field, and `HB.url` containing the item UUID). CSV import: `POST /v1/entities/import` (multipart `csv`). **v1 exposes export and deliberately skips import** — a malformed import is very hard to unwind. (`/v1/group/exports` is a separate async whole-group backup/restore job system; also out of scope.)
12. **No webhooks — confirmed.** All 96 operations inventoried; nothing subscribes to events. "Notifiers" are outbound shoutrrr notification URLs for Homebox's own scheduled-maintenance reminders, not an event-subscription API. **The trigger node polls.**
13. **Asset IDs exist** (`assetId`, e.g. `542-4108`): `GET /v1/assets/{asset_id}` resolves one, and `q=#<asset-id>` searches by it → the item resourceLocator gets From list / By ID / By asset ID modes.
14. **Delete semantics** (from schema at pinned commit): deleting a **location orphans its children** — child items/locations survive but their parent edge is cleared (no cascade on the parent/child edge). Deleting an **item cascades** its attachments (verified in handler: explicit attachment cleanup), custom fields, and maintenance entries. Stated plainly in the delete-field descriptions.

**Watermarks for triggers:** `createdAt` and `updatedAt` exist on every list row (verified live) and are sortable server-side (`orderBy=createdAt|updatedAt`, descending). Warranty data (`warrantyExpires`, `lifetimeWarranty`) is **not** in list summaries — the warranty-expiring trigger reads the CSV export (one request) and maps rows back to UUIDs via `HB.url`.

---

## Operations by tag

Legend — **v1**: ✅ exposed · 🔺 exposed indirectly (see note) · ❌ deliberately skipped.

### Entities (→ node resources Item & Location)

| Verb | Path | v1 | Node mapping / note |
|---|---|---|---|
| GET | `/api/v1/entities` | ✅ | item:getAll (`isLocation` absent) · location:getAll (`isLocation=true`) · location:getItems / tag:getItems (via `parentIds` / `tags`) |
| POST | `/api/v1/entities` | ✅ | item:create · location:create (sets the `isLocation` entity type) |
| GET | `/api/v1/entities/{id}` | ✅ | item:get · location:get · attachment:getAll (embedded list) |
| PUT | `/api/v1/entities/{id}` | ✅ | item:update · location:update · item:archive/unarchive — **always read-merge-write** |
| PATCH | `/api/v1/entities/{id}` | 🔺 | used internally where it suffices (quantity/parent/tags-only changes) |
| DELETE | `/api/v1/entities/{id}` | ✅ | item:delete · location:delete (children orphaned — warned) |
| GET | `/api/v1/entities/tree` | ✅ | location:getTree; also feeds the location dropdown (`?withItems` optional) |
| GET | `/api/v1/entities/{id}/path` | ✅ | item:getPath · location:getPath |
| POST | `/api/v1/entities/{id}/duplicate` | ✅ | item:duplicate (`copyAttachments`, `copyCustomFields`, `copyMaintenance`, `copyPrefix`) |
| GET | `/api/v1/entities/export` | ✅ | item:exportCsv (exports the whole inventory) |
| POST | `/api/v1/entities/import` | ❌ | CSV import — a bad import is very hard to unwind |
| GET | `/api/v1/entities/fields` | ✅ | loadOptions for custom-field names |
| GET | `/api/v1/entities/fields/values` | ✅ | loadOptions for custom-field values |

### Entities Attachments (→ node resource Attachment)

| Verb | Path | v1 | Note |
|---|---|---|---|
| POST | `/api/v1/entities/{id}/attachments` | ✅ | upload — hand-built multipart, n8n binary input; type enum above |
| GET | `/api/v1/entities/{id}/attachments/{attachment_id}` | ✅ | download → n8n binary output with real MIME type |
| PUT | `/api/v1/entities/{id}/attachments/{attachment_id}` | ✅ | updateMeta (`title`, `type`, `primary`) |
| DELETE | `/api/v1/entities/{id}/attachments/{attachment_id}` | ✅ | delete |
| POST | `/api/v1/entities/{id}/attachments/external` | ❌ | external-source attachment links — niche |

*(attachment:getAll = the embedded `attachments` array of `GET /v1/entities/{id}` — no dedicated list route exists.)*

### Item Maintenance + Maintenance (→ node resource Maintenance)

| Verb | Path | v1 | Note |
|---|---|---|---|
| GET | `/api/v1/entities/{id}/maintenance` | ✅ | getAll (for an item), `status` filter |
| POST | `/api/v1/entities/{id}/maintenance` | ✅ | create |
| GET | `/api/v1/maintenance` | ✅ | getAllGroup (whole group), `status` filter — also feeds the maintenance-due trigger |
| PUT | `/api/v1/maintenance/{id}` | ✅ | update |
| DELETE | `/api/v1/maintenance/{id}` | ✅ | delete |

*(No single-entry GET exists in the API — the node's Maintenance resource deliberately has no `get`.)*

### Tags (→ node resource Tag; this fork's name for labels)

| Verb | Path | v1 | Note |
|---|---|---|---|
| GET | `/api/v1/tags` | ✅ | getAll (bare array) — also feeds the tag multi-select |
| POST | `/api/v1/tags` | ✅ | create (`name`, `description`, `color`, `icon`, `parentId` — tags nest) |
| GET | `/api/v1/tags/{id}` | ✅ | get |
| PUT | `/api/v1/tags/{id}` | ✅ | update |
| DELETE | `/api/v1/tags/{id}` | ✅ | delete (items keep existing; only the tag link disappears) |

### Group + Statistics (→ node resource Group)

| Verb | Path | v1 | Note |
|---|---|---|---|
| GET | `/api/v1/groups` | ✅ | getSelf (`{id, name, currency, …}`) |
| GET | `/api/v1/groups/statistics` | ✅ | getStatistics (totals: items, locations, tags, users, item price, with-warranty) |
| GET | `/api/v1/groups/statistics/locations` | ✅ | getStatistics variant (totals by location) |
| GET | `/api/v1/groups/statistics/tags` | ✅ | getStatistics variant (totals by tag) |
| GET | `/api/v1/groups/statistics/purchase-price` | ✅ | getStatistics variant (value over time, `start`/`end`) |
| POST | `/api/v1/groups/invitations` | ✅ | getInvitationToken (`uses` 1–100, optional `expiresAt`) |
| PUT/POST/DELETE | `/api/v1/groups`, `/api/v1/groups/all` | ❌ | group management |
| * | `/api/v1/groups/invitations` (GET/accept/DELETE), `/api/v1/groups/members*` | ❌ | membership management |
| GET/POST/DELETE | `/api/v1/group/exports*`, `/api/v1/group/import` | ❌ | async whole-group backup/restore jobs |

### Skipped wholesale in v1

| Tag | Paths | Why |
|---|---|---|
| Actions | `/api/v1/actions/*` (incl. `wipe-inventory`) | bulk admin mutations; `wipe-inventory` is catastrophic in a workflow context |
| Authentication | `/api/v1/users/login*`, `logout`, `refresh`, password flows | package is API-key-only by design |
| User | `/api/v1/users/*` (self, settings, api-keys, register) | user management out of scope (`GET /v1/users/self` is used as the **credentialTest** endpoint) |
| Entity Types / Entity Templates | `/api/v1/entity-types*`, `/api/v1/templates*` | schema management; the node resolves the location/item type ids internally via `GET /v1/entity-types` |
| Notifiers | `/api/v1/notifiers*` | Homebox-internal maintenance reminders, not workflow events |
| Items (misc) | `/api/v1/labelmaker/*`, `/api/v1/qrcode`, `/api/v1/products/search-from-barcode` | label-printing/UI helpers |
| Reporting | `/api/v1/reporting/bill-of-materials` | redundant with item:exportCsv |
| Base | `/api/v1/status`, `/api/v1/currency` | unauthenticated instance metadata |

*(`GET /api/v1/assets/{id}` — ✅ used by the item resourceLocator's "By asset ID" mode.)*

---

## Trigger node (polling — no webhooks exist, finding 12)

| Event | Backing call | Watermark |
|---|---|---|
| New item | `GET /v1/entities?orderBy=createdAt&pageSize=…` | `createdAt` |
| Item updated | `GET /v1/entities?orderBy=updatedAt&pageSize=…` | `updatedAt` (field verified live) |
| Warranty expiring | `GET /v1/entities/export` (CSV, one request), window filter on `HB.warranty_expires`, UUID from `HB.url` | expiry date + emitted-set |
| Maintenance due | `GET /v1/maintenance?status=scheduled`, window filter on `scheduledDate` | scheduled date + emitted-set |
| New item in location | New item + `parentIds` filter (subtree via location tree) | `createdAt` |
