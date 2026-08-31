import type { SeedCategory } from './models'

// The backend has no categories API (verified: no controller/route/service exists for
// categories — see inspection notes). Category names can only be created, never read
// back, from the current endpoints. This list mirrors the actual categories present in
// the local dev database (queried directly via psql after running `npm run seed` in
// the backend repo — see scripts/seed.ts), so it resolves categoryId -> name for
// filters and book cards in THIS dev/demo environment. This is a client-side
// convenience only, not a general solution — if the backend is reseeded from scratch,
// or a category is added via direct DB access, this list must be refreshed to match
// (re-run `SELECT id, name FROM categories ORDER BY name;`). Ask the backend team to
// add GET /categories if this needs to work against arbitrary data.
export const SEED_CATEGORIES: SeedCategory[] = [
  { id: '27762a2d-31e4-4702-815e-f62ac44b3e62', name: 'Biography' },
  { id: 'a7aaafe0-91f1-4bfa-aaba-87d787a632e2', name: "Children's" },
  { id: 'b8833901-8eb0-4f6c-8c7d-a16140bcd694', name: 'Database' },
  { id: '8562e8d4-47f1-4031-950d-1b7d01923408', name: 'Fiction' },
  { id: '1dc30d43-7c50-4b8d-b623-7fe89b756380', name: 'History' },
  { id: '7b2efe1d-c2a7-4dfe-8f4b-85492fc71da3', name: 'Mystery & Thriller' },
  { id: '53aa27f7-e6dc-410f-9454-855088863ddd', name: 'Non-Fiction' },
  { id: 'a622a970-995d-46c2-9880-7c2855d0bcd5', name: 'Programming' },
  { id: '15b4d864-9bc9-4746-add1-d3cb9e754622', name: 'Science' },
  { id: '4a3987d0-4a0a-43b0-a5f8-e2e5d75f7479', name: 'Science Fiction' },
  { id: '31c07cb8-4331-4c8c-89d5-788ed97aeddf', name: 'Self-Help' },
  { id: 'b60e1cee-ecec-4f71-acb8-c326182ff486', name: 'Technology' },
]

export function getCategoryName(categoryId: string): string {
  return SEED_CATEGORIES.find((c) => c.id === categoryId)?.name ?? 'Uncategorised'
}
