---
title: Search Params are State
description: 'Component-level hooks vs router-level schemas for URL state: what each offers, what each trades, and how to test both.'
slug: search-params-are-state
pubDate: 2026-07-17
draft: false
tags:
  - ARCHITECTURE
  - FRONTEND
  - SOFTWARE_ENGINEERING
  - TESTING
---

Every filtered list page already has the state it needs. It lives in `useState`, survives until refresh, and vanishes when someone copies the URL. Cmd-click to open in a new tab, bookmark for later, share a link with a colleague, hit back after drilling in: every one of these assumes the URL carries intent. When it does not, the app feels subtly broken, and no stack trace points at the cause. Six months in, the same product often has five filter implementations, five incompatible link builders, and nobody can say which query params are canonical.

I think about URL state the way [TanStack argues](https://tanstack.com/blog/search-params-are-state) it should be thought about: search params are state. They deserve the same rigor as server state or component state. Where I diverge is narrower: **who should own the schema**. I've shipped one answer, a component-level hook stack, in multiple production apps; the other is the route-first model TanStack Router presents. This essay names the tradeoffs between them.

One note before we start: the examples use React Router, Vitest browser mode with Playwright, and Zod for validation. None of those choices are essential. Any router with reactive access to the browser search params can back the hook stack; any validation library can sit in `validateSearch`; any test harness that mounts a real router and asserts on `location.search` will do. The ownership question is the point; the packages are examples.

Put the schema in the hooks, and each call site owns its own `parse`, `format`, and cross-param rules. Put it on the route with `validateSearch`, and typed navigation inherits from there. The URL bar looks the same either way.

## Same URL bar, two owners

<figure class="url-state-diagram">
<svg viewBox="0 0 720 280" role="img" aria-labelledby="d1-title d1-desc">
<title id="d1-title">Component-level vs router-level URL state ownership</title>
<desc id="d1-desc">Two columns: hooks and codecs on the left, route validateSearch and typed navigation on the right.</desc>
<rect class="d-fill" x="28" y="48" width="300" height="200"/>
<rect class="d-fill" x="392" y="48" width="300" height="200"/>
<line class="d-ink" x1="28" y1="88" x2="328" y2="88"/>
<line class="d-ink" x1="392" y1="88" x2="692" y2="88"/>
<text x="40" y="72" class="d-t-label">component-level</text>
<text x="404" y="72" class="d-t-label">router-level</text>
<text x="44" y="118">useUrlState(key)</text>
<text x="44" y="144" class="d-t-muted">parse / format per param</text>
<text x="44" y="170">primitives → derived hooks</text>
<text x="44" y="196" class="d-t-muted">setPage(), setStatus()</text>
<text x="44" y="222">shared UrlStateKey enum</text>
<text x="408" y="118">validateSearch (Zod)</text>
<text x="408" y="144" class="d-t-muted">on route definition</text>
<text x="408" y="170">useSearch / getRouteApi</text>
<text x="408" y="196" class="d-t-muted">navigate({ search: prev => … })</text>
<text x="408" y="222">stripSearchParams middleware</text>
</svg>
<figcaption>Hooks on the left, route schema on the right.</figcaption>
</figure>

| Concern                             | Component-level ownership | Router-level ownership |
|-------------------------------------| --- | --- |
| Where the schema lives              | Hook definitions + shared key enum | Route `validateSearch` schema |
| Who enforces write safety           | Discipline + hook APIs; links built manually | `<Link>` and `navigate` typed against schema |
| Serialization                       | Per-hook `parse`/`format` | Router `parseSearch`/`stringifySearch` + middlewares |
| Cross-param rules (e.g. reset page) | Declared on setters (`deleteQueryStringsOnUpdate`) | Bundled in handlers or `useEffect`; reducer-style |
| Write API at call site              | Per-param setters (`setPage`, `setStatus`) | `navigate({ search: (prev) => patch })` |
| Adoption path                       | Incremental `useState` → `useUrlState` | Route schema before typed navigation |
| Schema inheritance                  | Manual; key enum in shared package | Hierarchical; child routes extend parent |
| Framework                           | Any router | TanStack Router |
| Default URL style                   | Human-readable per param (a design choice) | JSON-first default; customizable globally |

Both respond to the same failures: schema drift across files, untyped `<Link>` hrefs, and `URLSearchParams` treating everything as flat strings.

## useState-style hooks, instead of route schemas

The hook stack's entry point is deliberately simple: URL state should feel like local state at the call site.

```tsx
const [tab, setTab] = useState('overview')

// becomes

const [tab, setTab] = useUrlState(UrlStateKey.Tab, 'overview')
```

The tuple signature `ManagedUrlState<T>` intentionally mirrors `useState`:

```ts
type ManagedUrlState<T> = [T, (newValue?: T, replace?: boolean) => void]
```

The setter takes a value plus an optional `replace` flag (replace the history entry instead of pushing one, useful for stripping one-time params like auth tokens). Destructuring, passing setters to children, conditional rendering: all unchanged. You migrate one param at a time. A list page can move `page` and `sort` into the URL while keeping debounced search text in `useState`. I leave live search out of the URL on purpose: pushing a history entry on every keystroke pollutes the back stack and produces ugly share links. The page reset still needs wiring to the URL layer once the debounced query commits.

<figure class="url-state-diagram">
<svg viewBox="0 0 720 200" role="img" aria-labelledby="d2-title d2-desc">
<title id="d2-title">useState to useUrlState migration</title>
<desc id="d2-desc">Three stages: local state lost on refresh, URL-backed state, condensed default removed from URL.</desc>
<rect class="d-fill" x="24" y="56" width="200" height="100"/>
<rect class="d-fill" x="260" y="56" width="200" height="100"/>
<rect class="d-fill" x="496" y="56" width="200" height="100"/>
<text x="32" y="44" class="d-t-label">useState</text>
<text x="268" y="44" class="d-t-label">useUrlState</text>
<text x="504" y="44" class="d-t-label">default → omit</text>
<text x="36" y="88" class="d-t-muted">URL:</text>
<text x="36" y="112">/posts</text>
<text x="36" y="140" class="d-t-muted">refresh loses tab</text>
<text x="272" y="88" class="d-t-muted">URL:</text>
<text x="272" y="112" class="d-t-accent">/posts?tab=settings</text>
<text x="272" y="140" class="d-t-muted">shareable</text>
<text x="508" y="88" class="d-t-muted">URL:</text>
<text x="508" y="112">/posts</text>
<text x="508" y="140" class="d-t-muted">back to default (omitted)</text>
<path class="d-ink" d="M228 106 L 252 106"/>
<path class="d-ink" d="M252 106 l -8 -5 m 8 5 l -8 5"/>
<path class="d-ink" d="M464 106 L 488 106"/>
<path class="d-ink" d="M488 106 l -8 -5 m 8 5 l -8 5"/>
</svg>
<figcaption>Ownership stays at the component; the URL becomes the backing store.</figcaption>
</figure>

### Progressive depth

Instead of a big-bang rewrite, adoption is progressive:

```tsx
// 1. Optional string param
const [tab] = useUrlState(UrlStateKey.Tab)

// 2. String with default (drop-in useState replacement)
const [status, setStatus] = useUrlState(UrlStateKey.Status, 'active')

// 3. Custom codec for structured values
const [timeframe, setTimeframe] = useUrlState({
  key: UrlStateKey.Timeframe,
  defaultValue: { startDate, endDate },
  format: tf => `${fmt(tf.startDate)}_to_${fmt(tf.endDate)}`,
  parse: parseTimeframe,
})

// 4. Primitives hide boilerplate; derived hooks compose them
const [page, setPage] = useNumberUrlState(UrlStateKey.Page)
const [sort, setSort] = useUrlMultiSort()
const { constraints } = usePostsFetchConstraints()
```

Each param owns its codec. Multi-sort omits the default ascending direction from the URL, so `?sort=createdAt` means ascending and `?sort=createdAt_desc,name` means descending by date, then ascending by name:

```ts
type Sorting = { field: string; direction: 'ASC' | 'DESC' }

export const format = (value: Sorting[]) =>
  value
    .map(item =>
      item.direction === 'ASC'
        ? item.field // default direction stays out of the URL
        : `${item.field}_${item.direction.toLowerCase()}`,
    )
    .join(',')
```

Keys live in a shared enum so hooks and route builders agree on spelling:

```ts
export enum UrlStateKey {
  Page = 'page',
  PageSize = 'pageSize',
  Sort = 'sort',
  Status = 'status',
  Tab = 'tab',
  // …
}
```

When a value equals its default, the setter removes it from the URL. That is condensation on write, so defaults never clutter shared links:

```ts
const setValue = (newValue?: T, replace?: boolean) => {
  const shouldClear = newValue == null || newValue === defaultValue
  const formatted = shouldClear ? undefined : format(newValue)
  updateQueryString({
    deleteQueryStringsOnUpdate,
    key,
    replace,
    value: normalizeToUndefined(formatted), // blank/absent deletes the param
  })
}
```

Parsing fails soft: a malformed value from a stale bookmark reverts to the default instead of rendering an error page.

Cross-param rules attach to the setter that triggers them. Changing a filter deletes `page` in the same navigation (one search-string write, not a second history entry):

```ts
const [statuses, setStatuses] = useArrayUrlState({
  key: UrlStateKey.Status,
  deleteQueryStringsOnUpdate: ['page'],
})
```

Derived hooks compose primitives into reusable behavior. Pagination exposes individual setters, the same ergonomics as two `useState` calls, and wires its own cross-param rule: changing `pageSize` deletes `page`, because page 7 of 100-per-page is not page 7 of 20-per-page:

```tsx
export const useUrlPagination = (defaultPageSize = 100) => {
  const [page, setPage] = useNumberUrlState(UrlStateKey.Page)
  const [pageSize, setPageSize] = useNumberUrlState({
    key: UrlStateKey.PageSize,
    defaultValue: defaultPageSize,
    deleteQueryStringsOnUpdate: [UrlStateKey.Page],
  })

  return { page, pageSize, setPage, setPageSize }
}
```

The payoff is incremental adoption on an existing React Router app, per-param URL shaping without a global serializer policy, and cross-param rules colocated with the param that triggers them. Deep components import the same hook with no route context required.

The cost is discipline on the write side. `<Link>` and programmatic navigations do not inherit hook codecs automatically, so link-building drift is the failure mode I watch for. Setters and hooks agree on encoding; plain `to={`/posts?page=${n}`}` strings do not. I address that with small route-builder helpers that call the same `format` functions the hooks use:

```ts
export const postsListHref = (params: {
  page?: number
  status?: string
}) => {
  const search = new URLSearchParams()
  if (params.page != null && params.page !== 1) {
    search.set(UrlStateKey.Page, String(params.page))
  }
  if (params.status != null && params.status !== 'active') {
    search.set(UrlStateKey.Status, params.status)
  }
  const qs = search.toString()
  return qs ? `/posts?${qs}` : '/posts'
}
```

Nuqs solves the same problem with `createSerializer` over a shared parser map, and isolates re-renders per key the same way a careful hook stack should. Either way, the rule is the same: one encoding path for interactive updates and for links.

If you wrap `useSearchParams` naively, any search change re-renders every consumer. The right component-level design subscribes to one key at a time (`useSyncExternalStore` over the router or history, or Nuqs's per-key isolation). React then skips the render when that key's string is unchanged. That is an implementation choice, not a trade you inherit by putting state in hooks.

## The route file is the schema

[TanStack Router](https://tanstack.com/router/latest/docs/guide/search-params) is the most complete expression of router-level ownership. On a greenfield app where deep links matter and many routes share filters, I would rather pay a router migration once than keep fixing link drift by hand.

<figure class="url-state-diagram">
<svg viewBox="0 0 720 260" role="img" aria-labelledby="d3-title d3-desc">
<title id="d3-title">Router-level search param schema</title>
<desc id="d3-desc">Route validateSearch connects to Link, useSearch, and child route inheritance.</desc>
<rect class="d-fill" x="240" y="32" width="240" height="72"/>
<text x="256" y="58" class="d-t-accent">validateSearch</text>
<text x="256" y="82" class="d-t-muted">Zod schema on route</text>
<rect class="d-fill" x="48" y="148" width="160" height="56"/>
<rect class="d-fill" x="280" y="148" width="160" height="56"/>
<rect class="d-fill" x="512" y="148" width="160" height="56"/>
<text x="64" y="180">Link search=</text>
<text x="296" y="180">useSearch()</text>
<text x="520" y="180">child route</text>
<path class="d-ink" d="M328 104 L 128 148"/>
<path class="d-ink" d="M128 148 l 12 -3 m -12 3 l 9 -9"/>
<path class="d-ink" d="M360 104 L 360 148"/>
<path class="d-ink" d="M360 148 l -5 -9 m 5 9 l 5 -9"/>
<path class="d-ink" d="M392 104 L 592 148"/>
<path class="d-ink" d="M592 148 l -12 -3 m 12 3 l -9 -9"/>
<text x="296" y="236" class="d-t-muted">components consume; route defines</text>
</svg>
<figcaption>The route owns the schema; components consume it.</figcaption>
</figure>

With Zod 4, a schema object can be passed directly to `validateSearch` because Zod implements Standard Schema (`validateSearch: productSearchSchema` instead of a hand-rolled parse function). `.catch()` keeps malformed URLs from interrupting the user:

```tsx
const productSearchSchema = z.object({
  page: z.number().catch(1),
  sort: z.enum(['newest', 'oldest', 'price']).catch('newest'),
})

export const Route = createFileRoute('/shop/products')({
  validateSearch: productSearchSchema,
})
```

Child routes inherit parent search params and extend them type-safely. A component deep in the tree reads validated state via `getRouteApi` without importing the route module:

```tsx
const routeApi = getRouteApi('/shop/products')
const { page, sort } = routeApi.useSearch()
```

Writes are transactional partial updates. You pass a reducer, not a full object reconstructed by hand:

```tsx
navigate({
  search: (prev) => ({ ...prev, page: prev.page + 1 }),
})
```

Link-time URL hygiene uses search middlewares on the route. `stripSearchParams` removes defaults when hrefs are built; its sibling `retainSearchParams` carries chosen params across navigations:

```tsx
export const Route = createFileRoute('/shop/products')({
  validateSearch: productSearchSchema,
  search: {
    middlewares: [stripSearchParams({ sort: 'newest', page: 1 })],
  },
})
```

Global serialization is swappable: JSON-first by default, or something custom at the router. TanStack's docs show base64, and libraries like JSURL2 or Zipson slot in the same way:

```tsx
const router = createRouter({
  routeTree,
  stringifySearch: stringifySearchWith((value) =>
    btoa(JSON.stringify(value)),
  ),
  parseSearch: parseSearchWith((value) => JSON.parse(atob(value))),
})
```

<details class="callout">
<summary>Caveat: nested params as JSON</summary>

Out of the box, nested search params serialize as percent-encoded JSON in the query string (`includeCategories=%5B%22electronics%22%5D`). First-level keys stay flat and `URLSearchParams`-compatible; nested structures become JSON blobs. That is a deliberate trade for structure over readability. `stripSearchParams`, custom `stringifySearch`, or a hand-tuned per-param codec (component-level style) are the usual ways to clean shared links up.

</details>

Schema fragmentation is structurally difficult here: parent and child routes inherit and extend, and read and write safety share one object (`<Link search={…}>` and `navigate` are typed against the same schema). Selective re-renders are available via `useSearch({ select: ({ page }) => page })`, though if the selector returns a fresh object each call you need `structuralSharing: true` (or router-level defaults) or the component still re-renders on every navigation. Global serialization policy and link middlewares live in one place.

The price is adopting TanStack Router: schemas, middlewares, and typed navigation do not port to another router or to a static site with no client router. Cross-param invalidation still lives in application code, not the schema layer. Default JSON serialization favors structure over hand-tuned readability, though it is customizable. Condensation happens at link generation via middleware rather than on setter write. Upfront investment is higher before navigation is fully typed.

## Capability comparison

| Question | Component-level | Router-level (TanStack) |
| --- | --- | --- |
| Deep components, type-safe? | Import hook anywhere | `getRouteApi(path).useSearch()` or `useSearch({ from })` |
| Options without TanStack Router? | A hook stack like this one, Nuqs, framework loaders + Zod | N/A; adopting the router is the premise |
| Cross-param delete-on-update? | `deleteQueryStringsOnUpdate` on setter | Handler bundling or `useEffect` (below) |
| Pagination/sort composition? | `useUrlPagination`, `useUrlMultiSort` | Shared schema + thin hooks over `useSearch` |
| Per-param setters (`setPage(2)`)? | Yes; each hook returns its own setter | Partial update via `navigate` reducer (below) |

### Resetting page when a filter changes

The table rows on cross-param coordination are the interesting ones. Component-level ownership puts invalidation on the setter infrastructure:

```ts
const [statuses, setStatuses] = useArrayUrlState({
  key: UrlStateKey.Status,
  deleteQueryStringsOnUpdate: ['page'],
})
setStatuses(['DRAFT']) // page cleared in same URL write
```

Router-level ownership keeps the schema pure. The idiomatic TanStack pattern bundles `page` in the same navigation:

```tsx
navigate({ search: (prev) => ({ ...prev, sort: sortBy, page: 1 }) })
```

When params can change independently (back/forward, deep links), TanStack's [navigation guide](https://tanstack.com/router/latest/docs/how-to/navigate-with-search-params) also shows a reactive `useEffect`:

```tsx
useEffect(() => {
  if (search.query && search.page > 1) {
    navigate({ search: (prev) => ({ ...prev, page: 1 }), replace: true })
  }
}, [search.query, search.page, navigate])
```

The effect covers paths the handlers miss, at the cost of a second navigation tick: the filter change lands, a render happens, then the effect corrects the page. `replace: true` keeps the intermediate state off the back stack.

| | Setter-level | Handler bundling | `useEffect` |
| --- | --- | --- | --- |
| Single URL write | Yes | Yes | Often two |
| Wired once per param/hook | Yes | Per handler | Per effect |
| Clears page when filter changes via UI | On setter write | If that handler includes it | After the fact |
| Covers back/forward / deep-link edge cases | No (URL restored as-is) | No | Yes |
| Lives in schema layer | No | No | No |

### Individual setters vs reducer updates

TanStack gives you `Route.useSearch()` with optional `select` on the read side. On the write side everything routes through navigation rather than per-param setters:

```tsx
const { page, pageSize } = Route.useSearch()
const navigate = useNavigate({ from: Route.fullPath })

const setPage = (next: number) => {
  navigate({ search: (prev) => ({ ...prev, page: next }) })
}

const setPageSize = (next: number) => {
  navigate({ search: (prev) => ({ ...prev, pageSize: next, page: 1 }) })
}
```

`prev` is the validated state; you return a patch. The call site is still `navigate`, not a tuple setter. A [proposed `useSetSearch` API](https://github.com/TanStack/router/pull/971) was closed in favor of this pattern. Component-level bakes those wrappers into derived hooks:

```tsx
const PaginationControls = () => {
  const { page, setPage } = useUrlPagination()
  return <button onClick={() => setPage(page + 1)}>Next</button>
}
```

The reducer style has one edge the tuple style lacks: touching several params in one interaction is naturally atomic. With per-param setters, multi-param updates lean on `deleteQueryStringsOnUpdate` or a compound codec; calling two setters in the same event handler would race on the same query string. Each side papers over its gap with a thin wrapper.

## Testing the URL bar

My testing strategy for URL state follows the ownership boundary. Both sides are testable; the style of the test is what changes.

<figure class="url-state-diagram">
<svg viewBox="0 0 720 180" role="img" aria-labelledby="d4-title d4-desc">
<title id="d4-title">Testing URL state at two layers</title>
<desc id="d4-desc">Component-level integration tests vs router-level schema unit tests plus router integration.</desc>
<rect class="d-fill" x="32" y="48" width="300" height="108"/>
<rect class="d-fill" x="388" y="48" width="300" height="108"/>
<text x="48" y="76" class="d-t-label">component-level</text>
<text x="404" y="76" class="d-t-label">router-level</text>
<text x="48" y="104">hook + real router</text>
<text x="48" y="128" class="d-t-muted">click → assert location.search</text>
<text x="48" y="148" class="d-t-muted">export parse/format for units</text>
<text x="404" y="104">Zod .parse() in isolation</text>
<text x="404" y="128" class="d-t-muted">memory history + RouterProvider</text>
<text x="404" y="148" class="d-t-muted">errorComponent on bad input</text>
</svg>
<figcaption>Test the URL bar, not just React state.</figcaption>
</figure>

### Component-level: hook + real router

Production tests mount components with a real React Router wrapper (Vitest browser mode + Playwright). A helper seeds the initial URL; the render helper returns the router instance so assertions target `router.state.location.search` after interaction:

```tsx
export const queryStringHistory = (params: Record<string, string>) =>
  [`/?${new URLSearchParams(params).toString()}`]

it('clears page from URL when a filter updates', async () => {
  const { router } = renderComponent({
    routerInitialEntries: queryStringHistory({
      [UrlStateKey.Status]: 'DRAFT',
      [UrlStateKey.Page]: '3',
    }),
  })
  await userEvent.click(await screen.findByText('Update Status'))
  expect(router.state.location.search).not.toContain(UrlStateKey.Page)
})

it('removes the param when set back to its default', async () => {
  const { router } = renderComponent({
    routerInitialEntries: queryStringHistory({}),
  })
  await userEvent.click(await screen.findByText('Reset to default'))
  expect(router.state.location.search).not.toContain(UrlStateKey.Status)
})
```

Codec logic can be unit-tested separately by exporting `parse` and `format` from derived hooks. Invalid bookmarks fail soft by design: malformed values revert to defaults so the page stays usable. The same harness covers URL-backed UI state such as `?focused=issue-42` for a deep-linked detail panel: seed the param, open the panel, assert `location.search` still carries it after close and reopen.

### Router-level: schema unit + router integration

TanStack supports two layers, both documented.

Fast schema tests without a DOM. These use `.default()` to assert shape; runtime schemas more often use `.catch()` so a bad bookmark falls back instead of throwing into `errorComponent`:

```ts
const searchSchema = z.object({
  page: z.number().int().min(1).default(1),
  sort: z.enum(['newest', 'oldest', 'price']).default('newest'),
})

it('applies defaults when params are omitted', () => {
  expect(searchSchema.parse({}).page).toBe(1)
})

it('rejects invalid sort', () => {
  expect(() => searchSchema.parse({ sort: 'invalid' })).toThrow()
})
```

Integration tests mount the route tree with memory history:

```tsx
const router = createRouter({
  routeTree,
  history: createMemoryHistory({
    initialEntries: ['/products?sort=price&page=3'],
  }),
})
render(<RouterProvider router={router} />)
// assert validated search renders; assert errorComponent on invalid input
```

Invalid URL handling is configurable: Zod `.catch()` for silent fallbacks, or `errorComponent` when you want to surface malformed input. Cross-param coordination is application logic; you test the handler or effect explicitly.

| | Component-level | Router-level |
| --- | --- | --- |
| Fastest unit tests | Exported `parse`/`format` | Zod/schema `.parse()` |
| Integration harness | Real router render helper + `queryStringHistory` | `createMemoryHistory` + `RouterProvider` |
| Invalid URL behavior | Fail-soft → default (by design) | `.catch()` fallback or `errorComponent` |
| Link write safety | Route-builder helpers tested alongside hooks | Typed `<Link>` / `navigate` assertions |

## Nuqs, a third approach

[Nuqs](https://nuqs.dev) sits between the two models: hook-level ownership with shared parser maps and `createSerializer` for link building. It is closer to component-level ergonomics, with less route-file ceremony than TanStack. `useQueryState('page', parseAsInteger)` returns `[page, setPage]` per param. Custom codecs use the same parse/serialize type as `useUrlState`:

```ts
const parseAsBase64Json = createParser({
  parse: (query) => JSON.parse(atob(query)),
  serialize: (value) => btoa(JSON.stringify(value)),
})

const serialize = createSerializer({
  page: parseAsInteger,
  status: parseAsString,
})
// serialize({ page: 2, status: 'active' }) → '?page=2&status=active'
```

It addresses hook-scoped fragmentation without requiring a router migration. It does not provide hierarchical route schemas.

## Fits when

If you are greenfield or willing to migrate, and you want hierarchical search schemas plus typed `<Link>` writes, adopt TanStack Router and put the schema on the route. If you are staying on React Router (or similar) and want incremental `useState` migration, choose between a custom hook stack and Nuqs: roll your own when per-param encodings and cross-param rules are product-specific; reach for Nuqs when shared parsers and a link serializer are enough.

<figure class="url-state-diagram">
<svg viewBox="0 0 720 300" role="img" aria-labelledby="d5-title d5-desc">
<title id="d5-title">Fits-when decision for URL state ownership</title>
<desc id="d5-desc">Decision tree: adopting TanStack Router leads to router-level ownership; otherwise choose between a custom hook stack and Nuqs.</desc>
<rect class="d-fill" x="260" y="12" width="200" height="36"/>
<text x="276" y="36" class="d-t-label">url state schema</text>
<rect class="d-fill" x="210" y="68" width="300" height="40"/>
<text x="226" y="94" class="d-t-muted">Adopting TanStack Router?</text>
<rect class="d-fill" x="32" y="136" width="196" height="52"/>
<text x="48" y="160" class="d-t-accent">router-level</text>
<text x="48" y="178" class="d-t-muted">validateSearch on route</text>
<rect class="d-fill" x="250" y="136" width="220" height="40"/>
<text x="266" y="162" class="d-t-muted">Roll your own codecs?</text>
<rect class="d-fill" x="32" y="220" width="196" height="52"/>
<text x="48" y="244" class="d-t-accent">hook stack</text>
<text x="48" y="262" class="d-t-muted">useUrlState + helpers</text>
<rect class="d-fill" x="492" y="220" width="196" height="52"/>
<text x="508" y="244" class="d-t-accent">Nuqs</text>
<text x="508" y="262" class="d-t-muted">library parsers + serializer</text>
<text x="128" y="124" class="d-t-muted">yes</text>
<text x="430" y="124" class="d-t-muted">no</text>
<text x="148" y="208" class="d-t-muted">yes</text>
<text x="430" y="208" class="d-t-muted">no</text>
<path class="d-ink" d="M360 48 L 360 68"/>
<path class="d-ink" d="M360 68 l -5 -9 m 5 9 l 5 -9"/>
<path class="d-ink" d="M280 108 C 180 120 130 128 130 136"/>
<path class="d-ink" d="M130 136 l 9 -9 m -9 9 l 12 3"/>
<path class="d-ink" d="M440 108 C 360 120 360 128 360 136"/>
<path class="d-ink" d="M360 136 l -5 -9 m 5 9 l 5 -9"/>
<path class="d-ink" d="M300 176 C 180 192 130 208 130 220"/>
<path class="d-ink" d="M130 220 l 9 -9 m -9 9 l 12 3"/>
<path class="d-ink" d="M420 176 C 540 192 590 208 590 220"/>
<path class="d-ink" d="M590 220 l -12 3 m 12 -3 l -9 -9"/>
</svg>
<figcaption>Three leaves, three homes for the schema.</figcaption>
</figure>

## Closing

Search params are state. The choice is where you want the schema to live, and what you are willing to enforce at that layer: typed navigation at the router, or `useState`-style hooks at the component, with everything else composed on top.

I would pick based on the router already in the repo, how central shareable URLs are to the product, and whether the team writes more features or more routes. You can mix approaches (route-level validation for loaders, hook-level ownership for interactive filters), but then you own the tension between two schemas and it needs documenting.

The URL bar is the same either way. The owner of the schema is not.
