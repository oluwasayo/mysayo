---
title: Everything is a Blob
description: 'How I think about blob storage: one immutable primitive, a registry table, presigned URLs, and foreign keys as the garbage collector.'
slug: everything-is-a-blob
pubDate: 2026-07-05
draft: false
tags:
  - ARCHITECTURE
  - BACKEND
  - S3
  - SOFTWARE_ENGINEERING
  - TESTING
---

Every web product accumulates blobs: profile pictures, brand assets, uploaded documents, generated reports, rendered videos, inbound email attachments, and webhook payloads too large for the queue. Most codebases treat each of these as its own little feature. There is an avatar endpoint here, an attachments table there, and a one-off S3 call in a worker somewhere else. Six months in, there are five upload paths, five validation schemes, five ways to leak storage, and nobody can answer the question of what files the company actually has.

I think about this differently. Files deserve a **primitive**: one small, boring abstraction that sits beneath every feature, the same way a database connection pool sits beneath every query. I've designed, built, and currently operate a system very close to the one described here in production, so this isn't hypothetical. That said, this essay is about how I reason about the design, not a tour of any particular implementation.

One note before we start: the examples use S3 for object storage, Postgres (PostgreSQL) with foreign keys for the registry, EventBridge for scheduled work, Terraform for infrastructure, and TypeScript as the programming language. None of those choices are essential to the design. Any object store with the same capabilities (GCS, Azure Blob, Cloudflare R2, or even a directory on disk for a small deployment) can sit behind the store interface. Any scheduler can run the sweepers. Any relational database with foreign keys can hold the registry. Any IaC system, or no IaC at all, can provision the pieces. The design is the primitive; the examples are just one way to realize it.

The workload is narrower than "all large data." This primitive is for file-like values that are written once, referenced from product data, served many times, and eventually deleted: uploads, generated artifacts, inbound attachments, exported reports, and offloaded queue payloads. It is **not** a database, a log store, or a block device. If you need to patch byte ranges, append diffs to a large object, run concurrent writers against segments, or query inside the payload, use a storage model built around chunks, deltas, tables, or streams. Here, the unit of change is the whole blob: new bytes mean a new key.

That scope gives the design its goals:

- **Expose one simple interface across product surfaces.** A unified primitive gives the product a consistent storage model, makes onboarding easier for engineers, and creates one chokepoint for cross-cutting concerns such as access control, audit, quotas, validation, lifecycle, garbage collection, and observability.
- **Store arbitrary write-once values.** The primitive shouldn't care whether the bytes are an image, an attachment, a generated report, an export, or an oversized queue payload. It stores values that are written once and read potentially many times.
- **Do not accumulate garbage.** Unreferenced blobs carry forever costs, make customers' "right to be forgotten" harder to honor, and increase the amount of data that could be breached. If the application no longer needs a blob, the system should be able to prove that and delete it safely.

## One primitive, not another upload endpoint

The primitive's surface is deliberately tiny. Keys are typed as `BlobKey`, a branded string you get from `createBlobKey()` or a boundary parse, never from string concatenation, so nothing downstream accidentally passes a raw path fragment:

```ts
type BlobHead = { contentType: string; size: number }

type BlobStore = {
  // Server-side byte path.
  write(
    key: BlobKey,
    value: Uint8Array | ReadableStream,
    opts: { contentType: string; originalFilename?: string },
  ): Promise<void>

  // READ: return signed download URL.
  // WRITE: return signed upload URL.
  presign(
    key: BlobKey,
    opts: (
      | { operation: 'READ'; downloadFilename?: string }
      | { operation: 'WRITE'; originalFilename?: string }
    ) & { expiresInSeconds?: number },
  ): Promise<string>

  // Presigned-upload adoption boundary.
  adopt(
    key: BlobKey,
    bind: (key: BlobKey, head: BlobHead) => Promise<void>,
  ): Promise<void>

  read(key: BlobKey): Promise<ReadableStream>

  metadata(key: BlobKey): Promise<BlobHead>

  // Idempotent by design.
  delete(key: BlobKey): Promise<void>

  // S3 DeleteObjects; chunks of 1,000 keys per request.
  deleteBulk(keys: BlobKey[]): Promise<void>
}
```

That's the entire interface. There's no `uploadAvatar` and no `attachReport`. Features compose the primitive instead of wrapping the SDK themselves, and the payoff compounds in a way that's hard to appreciate until you've lived it. The same primitive can carry user uploads, generated artifacts, and email attachments. If your message queue offloads large bodies, it can even carry queue messages transparently, with consumers never knowing the difference. That last case reveals what the primitive really is: not a file-upload helper but storage infrastructure, and infrastructure code uses it as happily as product code does.

On the frontend the effect is one uploader component. A new feature that needs files picks a `PublicStorageDirectory` from the enum (defined in the next section), sets its size and type limits, presigns and PUTs, then hands the returned key to a feature mutation that adopts it. There are no new endpoints, no new validation code, and no new URL scheme. This is what adding file upload to a feature looks like in its entirety:

```tsx
const InvoiceForm = () => {
  const [attachment, setAttachment] = useState<UploadedFileEntry | null>(null)

  return (
    <form /* customer, amount, and other fields elided */>
      <BlobUploader
        directory={PublicStorageDirectory.enum.ATTACHMENTS}
        maxSizeInBytes={20 * 1024 * 1024}
        mediaTypes={[MediaType.Pdf]}
        onUploadComplete={([entry]) => setAttachment(entry ?? null)}
      />
      {/* on submit, pass attachment.blobKey to the mutation that adopts it */}
    </form>
  )
}
```

`BlobUploader` wraps the presign-and-PUT flow behind a dropzone with progress, retries, and the size and type checks declared right there in the props. The feature's only job is to hand `attachment.blobKey` to the mutation that adopts it. Whether the file is an invoice PDF, a profile picture, or a CSV import, the uploader is the same component with different props.

## Keys are identity, URLs are location

The single most important decision in the whole design costs one sentence: **the database stores keys, never URLs.** A key is a permanent identity; a URL is a temporary location minted from it on demand.

<figure class="blob-diagram">
<svg viewBox="0 0 720 250" role="img" aria-labelledby="d1-title d1-desc">
<title id="d1-title">Keys are identity, URLs are location</title>
<desc id="d1-desc">A database row stores a permanent blob key. Temporary URLs are minted from the key on demand and are allowed to expire.</desc>
<defs><filter id="rgh-b1" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-b1)">
<rect x="34" y="66" width="252" height="118"/>
<line x1="34" y1="100" x2="286" y2="100"/>
<rect class="d-dash" x="438" y="44" width="248" height="62"/>
<rect class="d-dash" x="438" y="150" width="248" height="62"/>
<path d="M292 112 C 350 96 380 84 430 74"/>
<path d="M430 74 l -13 -2 m 13 2 l -11 8"/>
<path d="M292 142 C 350 158 380 170 430 180"/>
<path d="M430 180 l -13 2 m 13 -2 l -11 -8"/>
</g>
<text x="40" y="58" class="d-t-muted">your database, forever</text>
<text x="48" y="90">account row</text>
<text x="48" y="128">avatar_blob_key:</text>
<text x="48" y="154" class="d-t-accent">AVATARS/018f3c2a-…</text>
<text x="312" y="66" class="d-t-muted">mint on demand</text>
<text x="450" y="70">presigned READ</text>
<text x="450" y="92" class="d-t-muted">…X-Amz-Expires=3600</text>
<text x="452" y="132" class="d-t-muted">expires in an hour</text>
<text x="450" y="176">tomorrow: a fresh URL</text>
<text x="450" y="198" class="d-t-muted">same key, new location</text>
</svg>
<figcaption>The key is identity and lives in the database. URLs are locations, minted on demand and allowed to die.</figcaption>
</figure>

Keys have a flat, two-segment structure: a directory and a **UUIDv7**. Both segments get branded types so that unvalidated keys are caught at compile time instead of invalid ones being discovered at runtime:

```ts
import { z } from 'zod/v4'

const PublicStorageDirectory = z.enum([
  'AVATARS',
  'ATTACHMENTS',
])
type PublicStorageDirectory = z.infer<typeof PublicStorageDirectory>

const PrivateStorageDirectory = z.enum([
  'GENERATED_REPORTS',
  'EXPORT_DOWNLOADS',
  'LARGE_QUEUE_PAYLOADS',
  'EPHEMERAL_PREVIEWS',
])
type PrivateStorageDirectory = z.infer<typeof PrivateStorageDirectory>

const StorageDirectory = z.union([
  PublicStorageDirectory,
  PrivateStorageDirectory,
])
type StorageDirectory = z.infer<typeof StorageDirectory>

const UuidV7 = z.uuidv7().brand<'UuidV7'>()
type UuidV7 = z.infer<typeof UuidV7>

const BlobKey = z
  .string()
  .superRefine((raw, context) => {
    const parts = raw.split('/')

    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      context.addIssue({
        code: 'custom',
        message: 'Blob key must be {directory}/{id}',
      })
      return
    }

    StorageDirectory
      .safeParse(parts[0])
      .error?.issues
      .forEach(issue => context.addIssue({ ...issue, path: ['directory'] }))

    UuidV7
      .safeParse(parts[1])
      .error?.issues
      .forEach(issue => context.addIssue({ ...issue, path: ['id'] }))
  })
  .brand<'BlobKey'>()

type BlobKey = z.infer<typeof BlobKey>

export const createBlobKey = ({
  directory,
  id,
}: {
  directory: StorageDirectory
  id: UuidV7
}) => BlobKey.parse(`${directory}/${id}`)

// Boundaries parse with BlobKey.parse() / UuidV7.parse()
// The store re-parses at its own boundary too; cheap insurance against `as` casts.
```

`BlobStore` takes `BlobKey`, not bare `UuidV7`, because the store's object name is the full `{directory}/{id}` path rather than the UUID alone. Split the types accordingly: `UuidV7` for the id segment (minted at presign time, validated when the client supplies it) and `BlobKey` for anything that touches storage or a database row. Zod gives you the validation once, at the network boundary (GraphQL arguments, REST bodies), and `.brand()` carries the proof inward. Carry it through the data layer too: ORMs like Drizzle brand columns at compile time (`.$type<BlobKey>()`), and query libraries like Slonik let you attach a Zod codec to result sets, so fetch time validates every row, not just types it. Raw SQL in either stack uses the same tagged template (`` sql`… WHERE id = ${blobKey}` ``), with the driver parameterizing interpolations. Either way, backed by the CHECK constraint you'll see in the schema, blob keys stay `BlobKey` at the database boundary and physically inside the database too, never bare `string`.

The brand is a compile-time guarantee though, and an `as BlobKey` cast defeats it, so the store is free to re-parse at its own boundary as defense in depth. Parsing is cheap, and it means `store.read()` never trusts a key it didn't validate itself. If the re-parse ever shows up in a hot path, Zod schemas can be compiled into near-zero-overhead validators at build time (see [zod-compiler](https://github.com/gajus/zod-compiler)). `BlobKey` parsing splits on `/`, insists on exactly two segments, then delegates each segment to `StorageDirectory` and `UuidV7`. There's no application-side regex duplicating rules you already declared elsewhere; the database keeps its own cheap structural guard as a CHECK constraint.

The only constructor that should mint a `BlobKey` is `createBlobKey()`. Everything else parses.

The directory never comes from user input. The **server** owns the enum. Every prefix in the bucket is declared upfront, and callers choose from the set rather than inventing paths. Expose only `PublicStorageDirectory` through your API (a GraphQL enum works well), keep `PrivateStorageDirectory` server-only, and let `StorageDirectory` be the full union used by `BlobStore`. Input sanitization becomes straightforward: the first segment is always one of a finite known set and the second is always a UUIDv7. There's no `../`, no slash-stripping regex, and no path-traversal edge case to maintain. Malicious input can't cross that boundary because neither segment is free text.

I use UUIDs rather than the user's filename for the second segment because filenames are user input. They collide, they carry PII into URLs and access logs, and the moment you interpolate them into a storage path you've signed up for path-traversal sanitization forever. A UUID sidesteps the entire class of problems. The original filename isn't lost; it becomes optional display metadata on the registry row and never becomes part of the storage key.

I chose UUIDv7 over the more common v4 because v7 puts a millisecond timestamp in the leading bits and randomness in the rest. The keys remain unguessable for capability URLs, but they sort roughly by creation time. That clusters B-tree inserts in indexes over blob keys, which matters once you're past modest volume. It also gives operations a useful secondary signal: pair a key-range filter with `created_at` and you can scope incident repair or reconciliation to a deploy window without scanning the whole bucket. Keep explicit timestamps too; the timestamp embedded in the key is a convenience, not the source of truth.

Within that workload, the second rule is as important as the first: **blobs are immutable.** New content means a new key, always, and the store refuses overwrites. Immutability would be the wrong fit for data you need to patch in place, but for file-like artifacts it's the property everything downstream depends on. Caching, copying, garbage collection, and distribution all get simpler because bytes, once written, never change.

### Where metadata lives

Object stores let you attach metadata at write time, and that's a fine way to start: stash the original filename and a tenant id on the object, then read them back with a `metadata()` call. It ages badly though. Object metadata isn't queryable; you can't ask the bucket for every blob belonging to tenant X without LISTing and HEADing the world. Reading it costs a network round-trip. And when the client uploads directly (next section), the *client* supplies those metadata values, which makes them exactly as trustworthy as any other user input.

The graduation path is a **registry table** in the database: one row per blob, holding the filename, content type, size, hash, tenancy, and timestamps (`created_at`, `updated_at`, `committed_at`). It is written by the server, indexed, joinable, and transactional with your domain data. The registry will prove its worth several more times in this essay.

```sql
CREATE TABLE blob (
  id                 TEXT PRIMARY KEY, -- the blob key: {directory}/{uuidv7}
  state              TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | COMMITTED | PENDING_DELETE
  durability         TEXT NOT NULL DEFAULT 'DURABLE', -- DURABLE | EPHEMERAL
  content_type       TEXT, -- recorded at commit time, from the object HEAD
  size_bytes         BIGINT,
  content_hash       BYTEA,
  original_filename  TEXT,
  tenant_id          UUID REFERENCES tenant (id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- auto-update with a trigger
  committed_at       TIMESTAMPTZ,
  delete_after       TIMESTAMPTZ,
  -- Cheap structural guard; the enum + Zod remain the real authority.
  CONSTRAINT blob_id_structure
    CHECK (id ~ '^[A-Z_]+/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'),
  -- Object facts are verified facts: a committed blob always has them.
  CONSTRAINT blob_committed_facts
    CHECK (state <> 'COMMITTED' OR (content_type IS NOT NULL AND size_bytes IS NOT NULL))
);

-- Every reference is a real foreign key. The constraint IS the refcount.
CREATE TABLE account (
  id              UUID PRIMARY KEY,
  -- ...
  avatar_blob_key TEXT REFERENCES blob (id) -- ON DELETE NO ACTION (the default)
);
```

Pair the timestamps for audit: `committed_at - created_at` is mint-to-commit latency; rows stuck in `PENDING` show up when `updated_at` still hugs `created_at`.

With that schema in place, the `BlobStore` interface divides cleanly. Three methods touch the registry: `write`, `presign` with `WRITE`, and `adopt`. Together they own the `PENDING` → `COMMITTED` state machine. `write` handles the server-side path in one shot. `presign` with `WRITE` creates the `PENDING` row before handing out a signed URL, optionally storing display metadata such as the original filename. `adopt` reads the object HEAD with `metadata()`, passes the key and the HEAD response to your `bind` callback for cheap validation, then promotes the row inside the same database transaction. Everything else (`read`, `metadata`, `delete`, and `presign` with `READ`) is store I/O against rows that already exist. Features never insert registry rows themselves; they call the primitive and let it enforce the transitions.

Two pieces deliberately stay object-side. `Content-Type` lives on the object because it's what every path serves by default. S3 can override it per presigned request (`response-content-type`, the same mechanism as the filename trick below), but the CDN path caches what the object stores, and any fetch that skips your mint endpoint gets the object's own header. The download filename doesn't need object metadata at all: S3 lets you override `Content-Disposition` per request, so you inject the registry's filename when minting the URL:

```ts
const mintReadUrl = async (key: BlobKey) => {
  // The registry owns the filename.
  const { originalFilename } = await db.blobs.byKey(key)

  return store.presign(key, {
    operation: 'READ',
    // Becomes Content-Disposition at mint time.
    downloadFilename: originalFilename,
    expiresInSeconds: 3600,
  })
}
```

There's no extra metadata round-trip, no object metadata to keep in sync, and the CORS `expose-headers` list stops accumulating `x-amz-meta-*` entries.

## Where the bytes flow

Here is the decision that dictates your bandwidth bill, your API server sizing, and your approach to validation: do file bytes pass through your API, or do they go straight to storage?

Proxying uploads through the API is the comfortable default because the server sees every byte, so it can validate, scan, and meter. Call `store.write()` and the primitive handles the full registry lifecycle in one shot: `PENDING`, bytes to the bucket, `COMMITTED`. It's also how you end up scaling API instances to move bytes that Node should never have touched. The alternative is the presigned upload: the client asks your API for permission, your API mints a short-lived signed PUT URL, and the client sends the bytes directly to the bucket.

<figure class="blob-diagram">
<svg viewBox="0 0 720 330" role="img" aria-labelledby="d2-title d2-desc">
<title id="d2-title">Presigned direct-to-storage upload</title>
<desc id="d2-desc">The browser asks the API to presign an upload, receives a signed PUT URL, sends the bytes directly to the bucket, then a feature mutation adopts the key. The registry row moves from PENDING to COMMITTED inside the same transaction as the domain foreign key.</desc>
<defs><filter id="rgh-b2" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-b2)">
<rect x="30" y="130" width="130" height="56"/>
<rect x="300" y="42" width="140" height="56"/>
<rect x="300" y="238" width="196" height="60"/>
<rect x="556" y="126" width="134" height="64"/>
<path d="M160 138 C 214 108 250 90 296 74"/>
<path d="M296 74 l -13 0 m 13 0 l -9 10"/>
<path class="d-dash" d="M300 96 C 254 122 214 138 166 152"/>
<path class="d-dash" d="M166 152 l 13 1 m -13 -1 l 11 -9"/>
<line x1="372" y1="100" x2="382" y2="234"/>
<path d="M382 234 l -6 -12 m 6 12 l 6 -12"/>
<path class="d-accent d-thick" d="M162 172 L 550 166"/>
<path class="d-accent d-thick" d="M550 166 l -14 -5 m 14 5 l -14 7"/>
<path d="M144 190 C 208 268 244 268 296 264"/>
<path d="M296 264 l -13 3 m 13 -3 l -11 -8"/>
</g>
<text x="60" y="164">browser</text>
<text x="344" y="76">API</text>
<text x="316" y="264">blob registry (DB)</text>
<text x="316" y="286" class="d-t-muted">PENDING, then COMMITTED</text>
<text x="586" y="162">bucket</text>
<text x="168" y="98" class="d-t-muted">1 · presign</text>
<text x="196" y="140" class="d-t-muted">2 · signed PUT URL</text>
<text x="230" y="156" class="d-t-accent">3 · PUT the bytes</text>
<text x="176" y="216" class="d-t-muted">4 · adopt via API</text>
<text x="396" y="220" class="d-t-muted">row per key</text>
</svg>
<figcaption>Uploads go straight to the bucket. The uploader presigns and PUTs; a feature mutation adopts. The API never carries the payload.</figcaption>
</figure>

The uploader's job is two steps, presign and PUT, and then it returns the key. This is the flow that `BlobUploader` from the first section wraps. It does **not** commit or adopt. Committing after a successful PUT conflates "the bytes landed" with "the application wants this blob". If the feature mutation that should bind the key never runs (the profile picture save fails, or the user abandons the flow), you're left with a `COMMITTED` orphan that the PENDING sweeper won't touch. Adoption is the commit boundary, and it belongs at the feature mutation that creates the first foreign key.

```ts
const upload = async (file: File) => {
  const { key, url } = await api.presign({
    operation: 'WRITE',
    directory: PublicStorageDirectory.enum.AVATARS,
    id: UuidV7.parse(uuidV7()),
    originalFilename: file.name,
  })

  await fetch(url, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  })

  // Handed to the feature mutation, not adopted here.
  return key
}
```

The feature mutation adopts, with one `adopt` call rather than a feature-specific upload handler:

```ts
const setProfilePicture = async (blobKey: BlobKey) => {
  await store.adopt(blobKey, async (key, head) => {
    if (head.size > MAX_AVATAR_BYTES) {
      throw new Error('Avatar is too large')
    }

    if (!ALLOWED_AVATAR_TYPES.has(head.contentType)) {
      throw new Error('Unsupported avatar type')
    }

    // Implicitly participates in the current transaction.
    await accounts.setProfilePicture(key)
  })
}
```

Inside the primitive, `adopt` reads the object HEAD, opens a continuation-local transaction (or joins the existing one; no transaction object to thread through nested calls), passes the key and HEAD to `bind`, then commits the registry row:

```ts
const adopt = async (
  blobKey: BlobKey,
  bind: (key: BlobKey, head: BlobHead) => Promise<void>,
) => {
  // The raw S3 layer beneath the primitive, not a recursive call.
  const head = await store.metadata(blobKey)

  await withTransaction(async () => {
    // Validation + domain FK insert.
    await bind(blobKey, head)
    
    // PENDING → COMMITTED; idempotent.
    await blobRegistry.commit(blobKey, {
      contentType: head.contentType,
      sizeBytes: head.size,
    })
  })
}
```

On a WRITE presign, `store.presign` inserts the `PENDING` row before returning the signed URL, optionally recording the original filename for later display. It doesn't record claimed object facts like content type or size. `adopt` then calls `metadata()` to confirm the object landed, and `bind(key, head)` receives both the key and the cheap HEAD response for feature-specific validation: size limits, content-type allowlists, quota checks, and whatever else that product surface needs before it creates the first foreign key. Only after `bind` succeeds does `blobRegistry.commit` record the real size and the client-declared content type from HEAD and flip the bit. The update fails if no row exists; an already-`COMMITTED` row is a no-op, which makes retries safe. If `bind` throws, the transaction rolls back and the blob stays `PENDING` with no foreign key, which is exactly the situation the PENDING sweeper exists for.

The API exposes `presign` and whatever feature mutations wrap `adopt`:

```ts
const presign = async ({
  operation,
  directory,
  id,
  originalFilename,
}: {
  operation: 'WRITE'
  directory: PublicStorageDirectory
  id: UuidV7
  originalFilename?: string
}) => {
  const key = createBlobKey({ directory, id })
  const url = await store.presign(key, {
    operation,
    originalFilename,
    expiresInSeconds: 3600,
  })
  return { key, url }
}
```

In the `adopt` path, `COMMITTED` means the bytes were verified **and** adopted, not merely uploaded. The foreign key is the ultimate liveness signal for garbage collection: even a `PENDING` blob with a referencing FK won't be collected, and the abandoned-upload sweeper we build in the garbage collection section promotes referenced `PENDING` rows instead of reaping them, in case someone forgets to route through `adopt`.

<details class="callout">
<summary>Alternative: the commit outbox</summary>

`adopt` keeps the commit synchronous and verified, but it isn't the only possible design. When call-site discipline is the worry, you can **drop `adopt` from the `BlobStore` interface** and let the database emit commit work the same way it emits GC candidates.

A trigger on domain tables fires when a new `blob_key` foreign key is inserted and enqueues the key into a `blob_commit_outbox` (`blob_key PRIMARY KEY`, `created_at`, same naming as the GC outbox). Model that outbox as a real foreign key too (`blob_key REFERENCES blob (id)`): while a row sits in the queue, it counts as a reference the same way `account.avatar_blob_key` does. A worker drains the outbox and promotes `PENDING` → `COMMITTED`, then deletes the outbox row. Feature mutations become plain domain writes, `accounts.setProfilePicture(blobKey)` for example, with no blob primitive call at the adoption site.

Reading while `PENDING` is fine for flows that don't need pre-read verification. The object may already be in the bucket after the client's PUT, and a presigned READ against a `PENDING` row works as long as you don't gate minting on `COMMITTED`. The registry state tracks adoption bookkeeping, not whether the bytes are fetchable. If a surface requires scanning or validation before serving, gate those reads on `COMMITTED`.

Neither the abandoned-upload sweeper nor the collector needs commit-outbox-specific logic. An unreferenced `PENDING` row is still fair game for the sweeper; one with an outbox row (or a domain FK) fails on `ON DELETE NO ACTION` the same way in both jobs. **Do not** attach the GC outbox trigger to `blob_commit_outbox`. Removing a queue row after a successful promote is not a dereference; it must not nominate the blob for collection. Only domain tables emit GC candidates. Exclude the commit outbox from the schema helper and CI invariant that require a trigger on every `blob_key` foreign key.

What you give up is the main thing `adopt` buys you: **`metadata()` before bind and `COMMITTED`.** The outbox worker flips the state bit without HEADing S3, so real size, content-type verification, and quota enforcement either happen elsewhere or not at all until something else notices. For background attachments where immediate verification matters less, that's often acceptable. For flows where you want the server to confirm the bytes before declaring the blob live, keep `adopt`.

</details>

A client could request a WRITE presign for a key that already exists: a reused `id`, a retry with the same UUIDv7, or a bug that mints the same key twice. In that case the `PENDING` insert inside `store.presign` fails on the registry's primary key before the signed URL is returned, so the client gets an error and must mint a fresh id. You didn't need a separate "does this key already exist?" check, and you didn't need to rely on S3's no-overwrite guard alone. The registry's uniqueness constraint is the immutability gate at the API boundary. It's the same property that makes foreign-key garbage collection work later, doing double duty here for free.

The registry gate needs a companion inside the URL itself, though. A presigned PUT stays valid until it expires, and nothing stops its holder from PUTing a second time to the same key, even after `adopt` has verified the first upload. So `store.presign` also signs `If-None-Match: '*'` into every WRITE URL (S3 supports conditional writes), and a replay fails with `412 Precondition Failed` instead of silently rewriting the object. The primary key stops a second presign; the condition stops a second PUT on the first URL. Together they're what "the store refuses overwrites" actually means.

The presigned approach wins on the economics. Your API stays a control plane, and a 150 MB video upload costs you a few hundred bytes of JSON. Be clear about what you traded away though: **your server never sees the bytes.** Every validation you used to do inline now has to happen somewhere else. Hold that thought; it returns in the threat modeling section.

## Two stores, no transaction

Presign and PUT are a distributed write across two systems, and they share no transaction with adoption. Every failure you'd expect exists in practice. The user closes the tab right after the presign, leaving a `PENDING` row and maybe an object that nothing references. The PUT succeeds but the feature mutation never runs, with the same result: still `PENDING`, still unreferenced. Or `adopt` succeeds but the response is lost and the client retries, which is safe because `blobRegistry.commit` is idempotent on an already-`COMMITTED` row.

The instinct is to have the client clean up after itself by firing a delete when an upload is cancelled. Do that; it's polite. But **client-side cleanup is an optimization, never a correctness mechanism.** Networks drop, laptops sleep, and processes die. The design has to assume the delete never arrives.

This is why the registry's `PENDING` state matters more than it looks. "Was this upload ever completed?" stops being a forensic investigation of the bucket and becomes a `WHERE` clause: any row still `PENDING` past the presign lifetime plus a grace window is an abandoned upload, and a sweeper can reap it mechanically. We will build that sweeper in the garbage collection section.

One aside worth a sentence: S3 has been strongly read-after-write consistent since late 2020, so `metadata()` inside `adopt` can trust an immediately preceding client PUT. Designs older than that date carry workarounds for eventual consistency that you no longer need.

## One bucket, many directories

I use a single bucket per environment, with the key's directory segment (a `StorageDirectory` value) as the organizing principle. Some values are **public** in the narrow sense that authenticated clients may request presigned writes into them (`AVATARS/`, `ATTACHMENTS/`); others are **private** and writable only by server code (the rest of the enum: `GENERATED_REPORTS/`, `EXPORT_DOWNLOADS/`, `LARGE_QUEUE_PAYLOADS/`, `EPHEMERAL_PREVIEWS/`). The distinction is enforced at the API layer: the presign endpoint accepts `PublicStorageDirectory` while `BlobStore` uses the full `StorageDirectory` union.

A common misconception is that a single bucket means one-size-fits-all object management. It doesn't. S3 lifecycle rules filter by prefix, so the directory convention is exactly the right place to attach per-class policies:

```hcl
resource "aws_s3_bucket_lifecycle_configuration" "blobs" {
  bucket = aws_s3_bucket.blobs.id

  rule {
    id     = "expire-export-downloads"
    status = "Enabled"
    filter { prefix = "EXPORT_DOWNLOADS/" }
    expiration { days = 1 }
  }

  rule {
    # Must outlive the queue's max retention including DLQ dwell
    # (14 days on SQS), or a redriven message loses its payload.
    id     = "expire-large-queue-payloads"
    status = "Enabled"
    filter { prefix = "LARGE_QUEUE_PAYLOADS/" }
    expiration { days = 15 }
  }

  rule {
    id     = "tier-generated-reports"
    status = "Enabled"
    filter { prefix = "GENERATED_REPORTS/" }
    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }
  }
}
```

What a single bucket genuinely costs you is at the bucket level: one default encryption configuration, one replication policy, one Object Lock setting, and a shared blast radius, since an IAM principal with object access to the bucket can reach every prefix. Those are real trade-offs and worth acknowledging. Lifecycle isn't one of them.

<figure class="blob-diagram">
<svg viewBox="0 0 720 400" role="img" aria-labelledby="d3-title d3-desc">
<title id="d3-title">One bucket, logical directories, retention tiers</title>
<desc id="d3-desc">A single bucket contains directory prefixes. Public prefixes accept client presigned writes; private prefixes are server-only. Each prefix carries its own retention policy: keep forever, tier to cheaper storage, expire by lifecycle rule, or sweep by cron.</desc>
<defs><filter id="rgh-b3" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-b3)">
<rect x="40" y="46" width="404" height="330"/>
<rect x="64" y="70" width="284" height="34"/>
<rect x="64" y="116" width="284" height="34"/>
<line class="d-dash d-muted-ink" x1="56" y1="162" x2="432" y2="162"/>
<rect x="64" y="200" width="284" height="34"/>
<rect x="64" y="246" width="284" height="34"/>
<rect x="64" y="292" width="284" height="34"/>
<rect x="64" y="338" width="284" height="34"/>
<path d="M466 100 L 356 96"/>
<path d="M356 96 l 12 -5 m -12 5 l 12 6"/>
<path d="M466 218 L 356 219"/>
<path d="M356 219 l 12 -6 m -12 6 l 12 6"/>
<path class="d-accent" d="M466 264 L 356 265"/>
<path class="d-accent" d="M356 265 l 12 -6 m -12 6 l 12 6"/>
<path class="d-accent" d="M466 310 L 356 311"/>
<path class="d-accent" d="M356 311 l 12 -6 m -12 6 l 12 6"/>
<path class="d-accent" d="M466 356 L 356 357"/>
<path class="d-accent" d="M356 357 l 12 -6 m -12 6 l 12 6"/>
</g>
<text x="48" y="38" class="d-t-muted">one bucket per environment</text>
<text x="76" y="93">AVATARS/</text>
<text x="76" y="139">ATTACHMENTS/</text>
<text x="64" y="186" class="d-t-muted">public above, private below</text>
<text x="76" y="223">GENERATED_REPORTS/</text>
<text x="76" y="269">EXPORT_DOWNLOADS/</text>
<text x="76" y="315">EPHEMERAL_PREVIEWS/</text>
<text x="76" y="361">LARGE_QUEUE_PAYLOADS/</text>
<text x="474" y="96" class="d-t-muted">keep forever · presign target</text>
<text x="474" y="140" class="d-t-muted">keep forever · presign target</text>
<text x="474" y="214" class="d-t-muted">cheaper storage at 30 d</text>
<text x="474" y="260" class="d-t-accent">lifecycle: expire in 1 day</text>
<text x="474" y="306" class="d-t-accent">swept by cron in minutes</text>
<text x="474" y="352" class="d-t-accent">expire in 15 d (outlives DLQ)</text>
</svg>
<figcaption>The directory prefix is where a retention policy attaches. Same bucket, different lifetimes.</figcaption>
</figure>

### Retention is a design decision

Once you see prefixes as the place where policies attach, blob lifetime stops being an afterthought and becomes a **tier you choose per directory**:

- **Permanent** (`AVATARS/`, `ATTACHMENTS/`): lives until something deliberately deletes it.
- **Day-ephemeral** (`EXPORT_DOWNLOADS/`): anything you're happy to keep for a day gets a one-line lifecycle rule and zero operational machinery. A generated "download your report" file is the poster child. It's fetched within minutes of being requested and expired by the platform within a day, with no cron, no code, and no failure mode to monitor. Know the granularity though: lifecycle expiration is day-level at minimum and asynchronous, so it won't delete something five minutes after creation. And size the window against the slowest consumer, not the typical one. Payloads too large for SQS are the trap here: the message body carries a blob key, not the bytes, and messages normally process in minutes, but one can sit in a dead-letter queue for days before someone redrives it, and a redriven message whose payload has expired is data loss. That's why `LARGE_QUEUE_PAYLOADS/` above expires at 15 days, one day past the queue's maximum retention, rather than 1. (One honest caveat: redriving re-enqueues the message and resets its retention clock, so even 15 days assumes redriven messages are processed promptly.)
- **Minute-ephemeral** (`EPHEMERAL_PREVIEWS/`): a short-lived preview that should vanish shortly after it's shown. Sub-day TTLs need application help, either deletion on interaction (the next preview deletes the last) or a small scheduled sweeper that reaps the prefix by object age.

Three retention tiers, one bucket, one primitive. This framing matters when we get to garbage collection: an entire class of would-be garbage never becomes the collector's problem because the platform expires it first.

## Reading blobs back

The read path mirrors the write path: **direct by default.** A resolver asks the primitive for a presigned READ (an hour is a sensible lifetime), the browser fetches from the bucket, and your API never touches the hot bytes. Once read volume justifies it, a CDN sits in front. The diagram below shows both paths.

<figure class="blob-diagram">
<svg viewBox="0 0 720 350" role="img" aria-labelledby="d4-title d4-desc">
<title id="d4-title">Two read paths</title>
<desc id="d4-desc">Default: the browser fetches directly from the bucket with a presigned GET. A CDN edge serves immutable objects from cache, with the bucket kept private behind origin access control.</desc>
<defs><filter id="rgh-b4" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="19" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-b4)">
<rect x="30" y="136" width="128" height="56"/>
<rect x="566" y="124" width="124" height="80"/>
<path d="M162 148 C 300 56 440 56 562 138"/>
<path d="M562 138 l -13 -6 m 13 6 l -14 4"/>
<rect x="296" y="258" width="162" height="52"/>
<path d="M120 196 C 168 260 220 280 292 284"/>
<path d="M292 284 l -13 3 m 13 -3 l -12 -8"/>
<path d="M462 278 C 516 262 556 234 592 208"/>
<path d="M592 208 l -13 4 m 13 -4 l -14 -3"/>
</g>
<text x="60" y="170">browser</text>
<text x="596" y="158">bucket</text>
<text x="600" y="182" class="d-t-muted">private</text>
<text x="232" y="60" class="d-t-muted">presigned GET (the default)</text>
<text x="330" y="290">CDN edge</text>
<text x="252" y="340" class="d-t-muted">immutable: cache forever · signed cookies</text>
<text x="606" y="242" class="d-t-muted">OAC</text>
</svg>
<figcaption>Direct presigned reads by default, and a CDN once read traffic justifies it.</figcaption>
</figure>

The CDN path exposes a genuine conflict in the design so far, so it deserves a closer look.

CDNs want **stable URLs**; the cache key is the URL, and a URL that changes on every request caches nothing. Presigned URLs are the opposite: unique per mint and expiring by design. Put a CDN naively in front of presigned reads and you get either zero cache hits or, worse, cached URLs that die mid-session. Security pulled us toward short-lived per-request URLs while distribution pulls exactly the other way.

Immutability resolves the standoff. An object that can never change, at a key that can't be guessed, can be treated as **cacheable forever**: serve it through a CDN with an effectively infinite TTL and you'll never need to invalidate it, because there's nothing to invalidate. New content is a new key. The bucket stays private (origin access control means only the CDN can read it), and authorization moves from the object to the edge. A signed cookie or an edge-signed URL grants a session access to a path prefix, instead of your API signing every object individually.

```hcl
resource "aws_cloudfront_origin_access_control" "blobs" {
  name                              = "blobs-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# The distribution reads the private bucket via OAC, caches immutable
# objects at max TTL, and gates viewers with a trusted key group
# (signed cookies scoped to a path prefix, minted by the API per session).
```

You don't need this on day one. Direct presigned reads are fine while traffic is modest and mostly first-party. A CDN becomes worthwhile when read volume, global latency, or the egress bill says so. CDN egress is meaningfully cheaper than S3 egress, and for a media-heavy product that line item arrives sooner than you'd think. The satisfying part is that nothing in the design has to change to adopt it: keys don't move, the registry doesn't care, and immutability was the enabling property all along.

## Collecting garbage without losing data

This is the part of the design that everything else has been setting up. Nobody designs garbage collection on day one, and deferring it is correct because none of the failure modes are urgent at small scale. Deferred isn't the same as unplanned though, and the difference between the two is whether deletion is *safe* when you finally build it. The hard problem was never the deleting; it's **proving that nothing points at a blob anymore**. That's a reachability question, the same one language runtimes answer, and the same two strategies apply: count references, or trace them.

This is why the registry schema made every reference a real **foreign key**. Every blob has a row from the moment it's conceived, every domain table points at that row, and the database can enforce reachability for you.

Now for my favorite part of the design: **don't maintain a reference count; let the foreign keys be the reference count.** A counter column would be a denormalized, drift-prone cache of something the constraint graph already knows authoritatively. Instead of asking whether the count is zero, *attempt the delete* and let the database answer:

```ts
const collectCandidate = async (blobKey: BlobKey) => {
  return await withTransaction(async () => {
    let deleted
    try {
      // Succeeds only if no foreign key still references the blob.
      // Ephemeral rows match zero rows here (durability filter), not an error.
      deleted = await database().execute(sql`
        DELETE FROM blob
        WHERE id = ${blobKey}
          AND durability = 'DURABLE'
        RETURNING id
      `)
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        // Still referenced, not garbage. Catching here is safe only because
        // the failed DELETE is this transaction's sole statement; wrap it in
        // a savepoint if the transaction ever grows more work.
        return false
      }

      throw error
    }

    if (deleted.rows.length === 0) {
      // Ephemeral blob, already collected, or never existed. Don't touch S3.
      return false
    }

    // Inside the callback, not in Postgres. A throw still aborts the transaction.
    // Delete swallows not-found; network errors throw → rollback above.
    await store.delete(blobKey)
    return true
  })
}
```

S3 doesn't participate in the database transaction, but **`store.delete` belongs inside the `withTransaction` callback anyway.** If the S3 call throws (a network timeout, a 503, a credentials blip), the error propagates out of the callback and the registry `DELETE` rolls back with it. You haven't condemned a row whose object is still live, and you haven't left a row deleted while the object deletion is uncertain. That coupling buys correctness, though holding a transaction open across an S3 call has a real cost, which the callout below discusses. `store.delete` should swallow the benign cases itself (`NoSuchKey`, an idempotent second delete) so that an already-absent object doesn't abort a collection that's otherwise correct.

The remaining gap is narrower: a crash **after** `store.delete` succeeds but **before** the transaction commits leaves a dangling registry row pointing at a gone object. The reconciliation sweep catches that direction. The old failure mode, where the row is deleted but the object leaks because `store.delete` never ran, goes away as long as collection stays inside the callback.

`store.delete` must still be idempotent for retries. A periodic **reconciliation sweep** remains worthwhile, since it catches that crash window as well as leaks from other paths, but it's no longer the primary guard against a failed S3 call during collection. We build it in the orphans section below.

<details class="callout">
<summary>Holding a transaction open across the S3 delete</summary>

The collector wraps `store.delete` inside the transaction, which pins a pooled database connection, the row lock, and Postgres's `xmin` horizon for the length of an S3 round-trip. On the happy path that's a single network hop, no worse than a second RDS call. The difference is the tail: RDS latency is bounded and local, while S3 can throttle (`503 SlowDown`), time out, and retry, and every one of those seconds is a second you hold database resources you don't need. "Don't do external I/O inside a transaction" is a good default for exactly this reason.

For a low-frequency background collector the blast radius is small. It runs off the hot path, concurrency is low, and the row is uncontended precisely because nothing references it, so the correctness win (an S3 failure rolls the row delete back, leaving no orphan) is usually worth it. At high volume it stops being free: connection-pool occupancy and vacuum pressure scale with S3's worst case rather than your database's. The abandoned-upload sweeper below takes the other fork: short database transactions, bulk S3 delete afterward, Inventory reconciliation for anything S3 missed.

The scale-friendly alternative keeps the transaction DB-only: run the same constrained row `DELETE`, commit, then delete the object *outside* the transaction, and let the reconciliation sweep reap the rare orphaned object that a crash or failed delete leaves behind. One warning about a tempting shortcut: flipping the row to `PENDING_DELETE` is not a substitute for the constrained delete. An `UPDATE` isn't checked by foreign keys, and the surviving row can gain a brand-new reference while the object dies. The row `DELETE` stays the liveness gate in both variants. You don't remove the fault, you choose its direction: in-transaction risks a *dangling row* (object gone, row remains) on a mid-commit crash, while commit-first risks an *orphaned object* (row gone, object remains) on a failed delete. Both are reconciliation's job; the second just keeps your transactions short.

</details>

The schema's `PENDING_DELETE` state is an observability marker for that commit-first variant, never a liveness mechanism: mark the row in one transaction so operators can see in-flight condemnations, run the constrained `DELETE` in the next, and flip the row back if the delete hits a foreign key. The constrained `DELETE` remains the only proof of unreachability, which is why the diagrams show just the two main-loop states.

If any row anywhere still points at the blob, `ON DELETE NO ACTION` rejects the delete, and that rejection *is* the liveness check. If the delete succeeds, you have proof, enforced by the database, that nothing references the key, and the object is safe to remove. Three properties fall out for free:

- **The reference set maintains itself.** Add a new table with a `blob_key` foreign key next quarter and the collector doesn't change at all. You **must** attach the GC outbox trigger to that table though, or dereferenced keys will never be nominated. That requirement is enforceable rather than aspirational, as we will see shortly.
- **The race is handled at the database layer.** Inserting a referencing row takes a key-share lock on the blob row, and the collector's `DELETE` conflicts with it. "A new reference appears while the collector fires" serializes inside the engine, with no application-level grace period to manage.
- **No drift.** A counter can be wrong. A constraint can't be wrong about whether a referencing row exists.

The collector still needs a feed, and this is where the outbox comes in. Think of it as a **candidate queue** rather than a counter. A trigger on referencing tables notes which key *might* have just become garbage, the collector tries the constrained delete, and the constraint remains the authority:

```sql
CREATE TABLE blob_gc_candidate (
  blob_key    TEXT PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One function for every referencing table: the FK column name arrives as a
-- trigger argument, so the body never mentions a specific table or column.
CREATE FUNCTION enqueue_blob_gc_candidate() RETURNS TRIGGER AS $$
  DECLARE
    old_key TEXT := to_jsonb(old) ->> tg_argv[0];
    new_key TEXT := CASE
      WHEN tg_op = 'UPDATE' THEN to_jsonb(new) ->> tg_argv[0]
    END;
  BEGIN
    IF old_key IS NOT NULL AND old_key IS DISTINCT FROM new_key THEN
      INSERT INTO blob_gc_candidate (blob_key) VALUES (old_key)
      ON CONFLICT (blob_key) DO NOTHING;
    END IF;
    RETURN COALESCE(new, old);
  END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER account_blob_gc
  AFTER UPDATE OF avatar_blob_key OR DELETE ON account
  FOR EACH ROW EXECUTE FUNCTION enqueue_blob_gc_candidate('avatar_blob_key');
```

The collector drains that queue in batches: a `SELECT … FOR UPDATE SKIP LOCKED` subquery claims a batch (the locking clause belongs to the `SELECT`, not the `DELETE`), a `DELETE … WHERE blob_key IN (…) RETURNING blob_key` consumes it, and the worker walks the returned keys. **`blob_key` is the primary key**, so nomination dedupes in the database: repeat dereferences of the same key hit `ON CONFLICT DO NOTHING` instead of multiplying outbox rows. `created_at` on the outbox row gives the collector a FIFO ordering when it matters. Concurrent workers never fight over rows.

The outbox trigger isn't optional infrastructure; it's how dereferenced keys enter the collector's queue. **Every** column that foreign-keys to `blob (id)` needs one. Forgetting a trigger on a new referencing table is a silent leak. The FK still prevents wrongful deletion while the key is referenced, but once nothing points at the blob, nothing nominates it for collection either.

Don't maintain those triggers by hand. A small helper reads your schema definitions, however you declare tables in the codebase, and **creates or drops the triggers** to match: one trigger per `blob_key` FK column, with the same function body everywhere. Run it from migrations or a bootstrap step so the live database always matches the declared schema.

Prove completeness in CI the same way you would prove any other schema invariant: query `pg_catalog`, enumerate every FK *column* that references `blob (id)`, check that each one has its own `AFTER UPDATE OR DELETE` trigger wired to that exact column, and fail with a human-readable list of what's missing. The invariant is per-column, not per-table: a table with two blob FKs needs two triggers, and a test that only asks "does the table have a trigger?" would green-light the second column leaking.

```ts
// Illustrative: query pg_constraint / pg_trigger, not application memory.
test('every blob_key foreign key column has a GC outbox trigger', async () => {
  const missing = await database().execute(sql`
    -- FK columns pointing at blob(id) without a trigger wired to that column

    SELECT
      c.conrelid::regclass AS table_name,
      a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
      AND a.attnum = ANY (c.conkey)
    WHERE c.confrelid = 'blob'::regclass
      AND NOT EXISTS (
        SELECT 1 FROM pg_trigger t
        WHERE t.tgrelid = c.conrelid
          AND NOT t.tgisinternal
          AND pg_get_triggerdef(t.oid) ~* 'AFTER UPDATE.*OR DELETE'
          AND pg_get_triggerdef(t.oid) LIKE
            '%enqueue_blob_gc_candidate(''' || a.attname || ''')%'
      )
  `)

  expect(
    missing
      .rows
      .map(r => `${r.table_name}.${r.column_name}`)
      .join('\n')
  ).toBe('')
})
```

When you add `account.avatar_blob_key REFERENCES blob (id)`, the migration runs the trigger helper and the schema test goes green. If someone adds the FK in a hurry and skips the trigger, the test fails before merge. The collector stays dumb and the schema contract stays complete.

<figure class="blob-diagram">
<svg viewBox="0 0 720 400" role="img" aria-labelledby="d5-title d5-desc">
<title id="d5-title">Garbage collection flow</title>
<desc id="d5-desc">Domain tables reference the blob registry through foreign keys. Update and delete triggers enqueue candidate keys into an outbox. A garbage collection worker tries to delete the registry row; a foreign key violation means the blob is still referenced. On success the object is deleted from the bucket. A reconciliation sweep periodically compares the registry with the bucket.</desc>
<defs><filter id="rgh-b5" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="29" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter></defs>
<g class="d-ink" filter="url(#rgh-b5)">
<rect x="36" y="44" width="150" height="48"/>
<rect x="36" y="112" width="150" height="48"/>
<rect x="280" y="58" width="190" height="120"/>
<rect x="532" y="58" width="158" height="70"/>
<path d="M190 66 L 276 88"/>
<path d="M276 88 l -13 1 m 13 -1 l -10 -9"/>
<path d="M190 138 L 276 122"/>
<path d="M276 122 l -12 6 m 12 -6 l -13 -4"/>
<path class="d-dash d-muted-ink" d="M474 94 L 528 94"/>
<rect x="56" y="252" width="212" height="54"/>
<path d="M112 164 C 116 196 118 220 120 248"/>
<path d="M120 248 l -6 -12 m 6 12 l 7 -11"/>
<rect x="356" y="250" width="180" height="60"/>
<path d="M272 278 L 352 279"/>
<path d="M352 279 l -12 -6 m 12 6 l -12 6"/>
<path d="M424 246 C 408 216 396 200 384 184"/>
<path d="M384 184 l 4 13 m -4 -13 l 12 6"/>
<path class="d-accent" d="M540 250 C 572 214 592 172 604 134"/>
<path class="d-accent" d="M604 134 l -10 9 m 10 -9 l 1 13"/>
</g>
<text x="66" y="74">account</text>
<text x="60" y="142">invoice</text>
<text x="212" y="60" class="d-t-muted">FK</text>
<text x="214" y="152" class="d-t-muted">FK</text>
<text x="296" y="88">blob registry</text>
<text x="296" y="114" class="d-t-muted">id · state · tenancy</text>
<text x="296" y="136" class="d-t-muted">PENDING | COMMITTED</text>
<text x="566" y="86">bucket</text>
<text x="480" y="82" class="d-t-muted">reconcile</text>
<text x="130" y="216" class="d-t-muted">trigger on update / delete</text>
<text x="76" y="284">gc candidates (outbox)</text>
<text x="380" y="284">GC worker (cron)</text>
<text x="430" y="212" class="d-t-muted">try DELETE row</text>
<text x="356" y="340" class="d-t-muted">FK violation = still referenced, skip</text>
<text x="582" y="180" class="d-t-accent">success:</text>
<text x="576" y="204" class="d-t-accent">delete object</text>
</svg>
<figcaption>The foreign key is the liveness check. The outbox only nominates candidates; the constraint decides.</figcaption>
</figure>

### The three kinds of orphans

With the machinery in place, every source of garbage maps onto something we have already built:

1. **Ephemeral blobs** never reach the collector. They're marked `durability = 'EPHEMERAL'`, they live under their own prefixes, and the retention tiers from earlier (lifecycle rules or the minute-sweeper) expire them. The collector explicitly skips them so the two systems never fight: `collectCandidate`'s `DELETE … AND durability = 'DURABLE'` matches zero rows for an ephemeral key, and the worker must treat **zero rows deleted** as a skip, not a success. Without that check, Postgres would happily complete the no-op `DELETE` and the code would still call `store.delete`, destroying an object whose registry row survives. Their registry rows carry `delete_after`, stamped at write or presign time when durability is `EPHEMERAL`, and a row reaper deletes rows past that timestamp, mirroring the lifecycle rule that removed the objects. This way a high-volume prefix like `LARGE_QUEUE_PAYLOADS/` doesn't pile up dangling rows for reconciliation to find.
2. **Abandoned uploads** are a query, not a mystery, thanks to `PENDING`:

```ts
// Backstop for uploads that were presigned but never adopted.
const sweepAbandonedUploads = async () => {
  const stale = await database().execute(sql`
    SELECT b.id FROM blob b
      WHERE b.state = 'PENDING'
        AND b.created_at < NOW() - INTERVAL '24 hours'
  `)

  const reaped: BlobKey[] = []

  for (const { id } of stale.rows) {
    try {
      await database().execute(sql`DELETE FROM blob WHERE id = ${id}`)
      reaped.push(id)
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        // A PENDING row that gained a foreign key isn't abandoned: someone
        // bound it without routing through adopt(). Promote it instead.
        const head = await store.metadata(id)
        await blobRegistry.commit(id, {
          contentType: head.contentType,
          sizeBytes: head.size,
        })
        continue
      }

      throw error
    }
  }

  await store.deleteBulk(reaped)
}
```

The sweeper deletes registry rows **one at a time** so a foreign-key violation on any single candidate doesn't abort the whole batch; referenced rows get promoted instead. Only keys whose rows were actually deleted go into `reaped`, and `store.deleteBulk` issues S3 `DeleteObjects` in chunks of 1,000. Database transactions stay short: no S3 round-trip inside a transaction, no connection held across network tail latency. The tradeoff is explicit: if a key's object outlives its row (an entry in the response `Errors` list, a timeout mid-batch, or the runtime crashing before the `deleteBulk` call), you're left with **orphaned objects** that have no registry rows. That's the commit-first fault direction, and it's acceptable here: the Inventory reconciliation sweep runs at lower frequency and deletes those leaks. A key whose bytes were never PUT costs nothing on the way out; bulk delete treats a missing object as already deleted.

3. **Dereferenced blobs**, the profile picture that got replaced for example, flow through trigger, outbox, and constrained delete as described above.

Two residual duties remain, because foreign keys stop at the database boundary. The crash window after `store.delete` but before commit can leave dangling rows (collector path). A periodic **reconciliation sweep** diffs the registry against a bucket listing, catching leaks (objects with no row) in one direction and dangling rows (rows with no object) in the other. The abandoned-upload sweeper's bulk delete can leave the same kind of leak when S3 misses a key; Inventory handles those too. Run it weekly, and make it report before you let it delete.

<details class="callout">
<summary>Reconciliation at scale: S3 Inventory, not LIST</summary>

At bucket scale you don't `LIST` to build that diff. You enable **S3 Inventory**, a scheduled (daily or weekly) manifest of every object, and diff it against an exported `blob.id` column with Athena or a sorted-merge. It is the tool AWS ships for exactly this purpose: asynchronous, off your request path, and costing a few dollars per run even at billions of objects. Scope each run to a prefix or a UUIDv7 time range so it stays bounded, and treat it as a backstop. Orphans only come from the rare crash or failed-delete window, so weekly or even monthly is plenty.

The one real trap is that Inventory is an eventually-consistent snapshot: a just-uploaded object may be missing and a just-deleted one may still appear. "In the bucket but not in the registry" is therefore a **candidate**, never a delete order. Age-gate it past the presign-to-adopt window and re-check the live registry at delete time, or you'll race an in-flight upload.

</details>

The collector itself is a scheduled job, and the infrastructure is simple:

```hcl
resource "aws_scheduler_schedule" "blob_gc" {
  name                = "blob-gc"
  schedule_expression = "rate(5 minutes)"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = aws_lambda_function.cron_handler.arn
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ cron = "BLOB_GC" })
  }
}
```

Each schedule fires a named job, and a small dispatcher maps that name to a handler. Making that mapping type-safe, with one scheduler entry per name, one handler per name, and the compiler complaining when they drift, is a topic for another post.

<details class="callout">
<summary>Two failure modes we deliberately don't design for</summary>

Both of these defeat the collector, and both come from the same place: the collector trusts foreign keys and nothing else. Rather than complicate it, the system draws a hard line. **A blob's liveness is its foreign keys, and anything not referenced by an FK is fair game for collection.** Each of these is treated as a usage violation to document, not a case to defend against.

**Mode 1, adoption without a reference:** a `bind` that creates no foreign key leaves a `COMMITTED` blob that nothing ever nominates. No referencing row means no trigger, so the outbox never sees it and it leaks quietly. A crash between a non-transactional server-side `write` and its domain insert leaves the same orphan. We don't build for this.

If it ever became a real problem, the cheap heuristic is a `last_used_at` column on the registry row. Fold the touch into the read itself (`UPDATE blob SET last_used_at = NOW() WHERE id = ${blobKey} RETURNING *` in place of a plain `SELECT`) and add a sweep that nominates rows untouched for a long window, inferring reachability from access rather than from constraints. Write-on-read costs more than a plain select at high throughput, and there are ways to claw that back, such as coalescing or batching the timestamp updates, but that's exactly the kind of detail a backstop we're not building doesn't need to settle here.

**Mode 2, references the database can't see:** a key stored in a `jsonb` document, a `text` column with no foreign key constraint, an array, or an external system is invisible to the constraint the collector relies on, so the collector will treat that blob as garbage and delete it. This isn't a case we protect against; it's the contract. Client surfaces **must** express blob references as real foreign keys. When data genuinely has to live somewhere unconstrained, the surface is still required to create a synthetic FK column, a small "this blob is in use" row, and point its non-FK location at that. Keys without a foreign key are collectable by definition, and that's intentional. This system fails closed and clients that need access must abide by the rules.

</details>

### Sharing, and the shard problem

The FK-as-refcount scheme has one hidden precondition: a foreign key requires the referencing row and the registry row to live in **the same database**; on a sharded deployment, the **same shard**. Shard `user_profile` by country and `blob` by blob identity, and nothing co-locates: the FK column sits on the profile shard, the registry row sits on the blob shard, and **cross-shard foreign keys don't exist** in Postgres. Sharding only the registry by blob id does not pull `user_profile.avatar_blob_key` along with it.

A simple solution to this is to take advantage of the **immutability** of blobs. A copy is only dangerous when the original can change underneath it and the two diverge. A write-once blob can never change, so "sharing" a blob across tenants can simply mean *copying* it: a new key in the recipient's namespace, byte-identical to its source forever, with its own single-shard reference graph. S3's server-side copy keeps the bytes inside S3, so you pay for duplicated storage rather than transfer. And the collaboration objection dissolves once you notice that collaboration was never a blob-layer concern. Two parties watching a document evolve are sharing a *mutable document*, which you model as a sequence of immutable blob versions plus a shared pointer at a higher layer, never as one shared mutable blob.

The honest caveat: a copy is a fork. It is wise to store explicit `copied_from` metadata if you care about lineage, and bear in mind that takedowns don't cascade. If the source must be purged, each tenant's copy is its own problem. For an immutable store that's usually the right trade, but it's not a free lunch.

## Testing the primitive

My testing strategy for blob storage is layered, and the layers have different jobs.

The primitive itself is integration-tested against a real (local) backend. LocalStack speaks enough S3 for the tests to do genuine presigned round-trips: mint a PUT URL, `fetch` real bytes into it, read them back, and check the metadata. This exercises exactly the parts a mock would lie about: signature construction, the `If-None-Match` no-overwrite guard, and the `Content-Disposition` override. Anything that emulates the S3 API works here; if LocalStack's community tier doesn't fit, free MIT-licensed alternatives like [MiniStack](https://ministack.org/) and [Floci](https://github.com/floci-io/floci) speak the same API on the same port. Wiring it up is a couple of lines of environment-aware config:

```ts
const store = new S3BlobStore({
  bucket: `myapp-${environment}-blobs`,
  ...(environment !== 'production' && {
    // Local S3 emulator (LocalStack, MiniStack, Floci…)
    endpoint: 'http://localhost:4566',
    forcePathStyle: true,
    credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
  }),
})
```

A handful of golden-path flows go end-to-end through the API: presign via the real mutation, upload real bytes, `adopt` via the feature mutation, and assert the domain record. The boundaries between the layers are where two-phase bugs live.

The database gets its own invariant test here: every `blob_key` FK must publish to the GC outbox, or merges ship silent storage leaks.

Everything else mocks the primitive. Once `store.write` is stubbed to return a key, a test about some domain feature is a test about *that domain*, not about S3, and it runs in microseconds. The interface from the first section is what makes this clean: one boundary to mock, everywhere, identically. Local development runs the same emulator container, so "works on my machine" includes the storage layer.

## The threat model

A presigned URL is a **capability**: whoever holds it has the access it encodes, no questions asked. That's the right mental model for the whole security discussion, because it forces the four questions that matter. Who may *mint* a capability? What *scope* does it carry? How *long* does it live? And what happens when it *leaks*? Here are the pitfalls I'd design against from day one:

- **Unscoped read minting:** an endpoint that presigns a GET for any key the caller names is an oracle. Learn someone's key, read their bytes. Key unguessability is a nice property, not an authorization model. The registry is the fix, since it knows the tenancy of every key; the mint endpoint can require that the caller's tenant matches the row's.
- **Trusting the client at adopt:** with direct uploads your server never saw the bytes, so `adopt` is where verification belongs. Use `metadata()` for the real size, sniff magic bytes for the real type (the declared `Content-Type` is client input), enforce quotas, and record a checksum for end-to-end integrity. The dedup callout at the end shows S3 verifying that checksum for you at upload time.
- **Client-stamped tenancy:** *unsigned* object metadata on a client-executed PUT is whatever the client typed, so don't treat it as authority. You *can* force a contract by signing the metadata headers into the presigned URL. SigV4 folds their values into the signature (they appear in `X-Amz-SignedHeaders`), so a changed or missing header fails with `SignatureDoesNotMatch` and the server pins server-chosen values the client can't alter. Even then, tenancy's authority belongs in the registry, which is queryable, joinable, and transactional in a way object metadata never is; signed metadata is at most a redundant copy.
- **No size ceiling:** a presigned write doesn't inherently bind the object length. Client-side limits are advisory; the `metadata()` check inside `adopt` is where a hostile 5 GB upload gets caught and reaped.
- **One role to read them all:** a single compute role with `s3:*Object` on the whole bucket means one compromised service reaches every tenant's every prefix. Scope IAM by prefix where the deployment allows it.

Then there's revocation, which deserves its own paragraph because the answer is structural. A signed URL or token is validated by checking the signature and expiry. That's pure math with no lookup, which is why it's fast, and it's exactly why it can't be revoked: revocation means consulting mutable state at request time, and there is none. If you need kill-switch semantics you must reintroduce state, and the cheapest useful mechanism is an **epoch check**. Stamp a version into the token, compare it against a stored current version per blob or per owner, and bump the version to instantly invalidate everything previously minted:

```ts
const { blobKey, epoch } = verifyToken(req.params.token)
if (epoch !== (await currentEpoch(blobKey))) {
  return res.status(403).end() // Revoked.
}
```

One lookup per request buys you bulk revocation. Notice the fine print though: revocation only stops *new* fetches. Bytes already sitting in a browser or CDN cache keep working until the cache expires, so `Cache-Control: immutable` with a long TTL and "we can revoke access" are, to a first approximation, opposing promises. Decide which one each directory of content needs, and don't promise both.

## What I deferred, and what's next

- **Content-hash deduplication:** keys are UUIDv7s, not content digests, so identical files uploaded twice are stored twice. Immutability keeps dedup available as a safe *future* retrofit, since content that never changes can be collapsed behind an indirection layer with zero correctness risk. That's precisely why I don't need it on day one.
- **Multipart and resumable uploads:** a single presigned PUT caps you around what a browser can push in one shot, and incomplete multipart uploads are their own species of invisible orphan with their own lifecycle rule. Big-file handling is a post of its own.
- **Erasure in a world of copies:** copy-on-share, S3 versions, CDN caches, and backups mean that "delete this user's data" isn't one `DELETE`. The elegant answer involves per-tenant encryption keys and crypto-shredding, and it also deserves its own post.
- **Operating the thing:** the metrics that matter (orphan rate, egress, etc) are another post.
- **Agent instructions:** now that coding agents write a growing share of the code, the storage rules deserve a few lines in the repository's agent instructions (`AGENTS.md`, a Cursor rule, a Claude skill, or whatever your tooling reads): always go through the primitive and `<BlobUploader>`, store keys rather than URLs, and make every reference a real foreign key. The one-chokepoint property means the whole discipline fits in a handful of bullets, and an agent that follows them can't invent a sixth upload path for the same reason a new engineer can't.
- **Deferred knowingly:** virus scanning, per-tenant quotas, and cross-region replication are all real, and all deferred. *Knowingly*, which is the part that counts.
- **Out of scope entirely:** client-side encryption and full cost modeling.

<details class="callout">
<summary>Content-addressed dedup, when you want it</summary>

The deferred dedup above has a clean path, and S3 hands you the primitive for it. Require the client to declare a content hash at WRITE presign and sign it into the URL as `x-amz-checksum-sha256`. S3 then verifies the uploaded bytes against that digest server-side and rejects a mismatch, so the server never re-hashes. `adopt` reads the value back via `HeadObject` with `ChecksumMode: ENABLED` and records it in `content_hash`.

Then the optimization: when a later presign arrives for a hash that's already `COMMITTED`, skip the upload entirely and mint an **alias**, a new registry row with its own key, tenancy, and foreign keys, pointing at the existing object instead of a fresh one. Aliasing is genuinely new machinery. Today one key maps to one object, so the collector would need to delete the underlying object only when the *last alias* is gone, not the last row.

Two caveats. Multipart uploads report a composite-of-parts SHA-256 rather than a whole-object digest, and S3's full-object multipart checksums are CRC-based, which is fine for integrity but useless as content identity, so for multipart the client has to hash the whole file itself. And immutability is what makes any of this safe, since an object shared across aliases can never change beneath them. (`BlobHead` grows an optional `checksumSha256` field so `adopt` can hand the verified digest to `blobRegistry.commit`.)

</details>

None of this is a small-scale consolation prize, by the way. Meta, in their recent [AI storage blueprint](https://engineering.fb.com/2026/07/01/data-infrastructure/metas-ai-storage-blueprint-at-scale/) publication, presented how they rebuilt their exabyte-scale BLOB stack around the same core ideas: collapsing scattered metadata into one flat, authoritative store, streaming bytes directly between storage and clients instead of proxying them through an API tier, and caching aggressively on the back of data that's written once and read many times. Their constraints (GPU stalls, pMax latencies, datacenter power budgets) have nothing in common with ours, which is exactly what makes the convergence interesting: these are properties of the problem, not of the scale.

What I'd defend to the last is the overall design: an immutable primitive with a tiny interface, keys as identity in a registry the database owns, bytes flowing around the API rather than through it, retention chosen per prefix, and a garbage collector whose correctness is enforced by foreign keys instead of promised by application code. Every hard problem in this essay got easier the moment the bytes stopped being allowed to change. If you take one thing from this essay, take that.
