# Open questions

Things Phase 0 discovery could not fully settle, with the decision taken in
each case. None block v1; they are recorded so a later version can revisit
them against a newer pinned spec.

1. **Multiple location entity types.** The instance ships two built-in types
   (`global.item`, `global.location`), but users can define more via
   `/v1/entity-types`, including additional `isLocation: true` types.
   `location:create` uses the *first* type with `isLocation: true`. If an
   instance defines several location types, which one should win is a UI
   decision Homebox itself doesn't surface in the spec. Revisit if users ask.

2. **`parentItemIds` query field.** The backend's `EntityQuery` struct carries
   a `ParentItemIDs` field, but the v0.26.2 handler never populates it from a
   query parameter. Not exposed; watch for it becoming a real parameter in a
   later version.

3. **`thumbnail` attachment type.** The attachment type enum includes
   `thumbnail`, which the server generates itself. The upload UI deliberately
   omits it; uploading with that type manually is untested.

4. **Invitation token default expiry.** `POST /v1/groups/invitations` accepts
   an optional `expiresAt`; the server default when omitted is not documented
   in the spec. The node passes the field through only when set.

5. **`itemUpdated` trigger and bulk server-side mutations.** Operations that
   touch many rows at once (e.g. `syncChildEntityLocations`, the `/actions/*`
   endpoints run from the Homebox UI) bump `updatedAt` and will fire the
   Item Updated event for every affected item. That is arguably correct
   behaviour, but worth knowing before pointing a heavyweight workflow at it.

6. **Warranty trigger cost on very large inventories.** The warranty event
   reads the full CSV export each poll (one request; ~230 items ≈ tens of KB
   on the reference instance). For inventories orders of magnitude larger, a
   dedicated warranty query would be preferable — the API doesn't offer one
   as of v0.26.2.
