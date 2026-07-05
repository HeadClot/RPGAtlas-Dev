# Project Compass — Phase M3 spec: Engine parity II (battle math & traits)

**Phase:** M3 · **Model:** Opus 4.8 (Ultracode) · **Tags:** `mig-3` at phase exit (M3·C)
**Roadmap:** `docs/MZ_MV_MIGRATION_ROADMAP.md` (phase M3) · **Contract:** `docs/mz-mv-parity-matrix.md`
**Governing decisions:** D1 (formula sandbox, signed with amendments a+b), D2 (FORMAT_VERSION
stays 2), D6 (traits on `ClassDef` only), D7 (`luk` locked skip).

The hard core: MZ-formula-compatible combat without breaking Atlas-native projects. Every
schema addition is **optional-only** — FORMAT_VERSION stays 2, Atlas-native skills are
untouched (absent fields ⇒ byte-identical native behavior, zero extra RNG draws), and the
Playwright suite must stay at 0 regressions.

---

## M3·A — Damage-formula evaluator (matrix §7 + §6 code 11 + §5 code 22 hit/eva/cri)

**Scope (matrix "M3·A — formula" bill):** the sandboxed `a`/`b`/`v[n]` formula-string
evaluator, `variance`, `critical`, drain types (5/6), %-based HP/MP recover (effect
value1), and hit/eva/cri ex-params feeding the battle path.

### The evaluator — `src/shared/formula.ts` (new, pure, dependency-free)

A purpose-built **restricted-AST recursive-descent parser + AST-walking evaluator**,
exactly per decision D1. Formulas are **parsed, never executed** — no `new Function`,
no `eval`, no ambient globals.

Accepted grammar (everything else is a parse error):

- numeric literals (int/float), parenthesized expressions;
- `+ - * / %`, unary minus, comparisons (`< <= > >= == != === !==`), ternary `?:`;
- `a.<stat>` / `b.<stat>` where `<stat>` ∈ `atk def mat mdf agi mhp mmp hp mp level`
  (read-only facades supplied by the caller);
- `v[<expr>]` — game variables (read-only lookup function supplied by the caller);
- `Math.<fn>(…)` where `<fn>` ∈ `min max floor ceil round abs pow sqrt randomInt`
  (arity-checked; `min`/`max` variadic).

No strings, no assignment, no statements, no `&&`/`||` (outside the D1 whitelist — a
formula using them rejects with an honest report; widening needs a new gate decision),
no member access beyond the whitelists above (`a["atk"]`, `a.constructor`, `v.length`,
`a.luk` all reject — D7 keeps `luk` a locked skip). Gate amendments enforced: **(a)**
`Math.randomInt` draws from an **injected** `randomInt(n)` — the engine wires the
seedable `rnd` from `src/engine/util.ts`, so imported combat is reproducible under
`?rngseed=` and the reference-vector vitest is deterministic; **(b)** input limits —
formula length ≤ 512 chars, nesting depth ≤ 32 — over-limit takes the same reject path.

API: `parseFormula(src)` → AST or plain-language error; `getFormula(src)` — cached
compile, returns `null` for rejects (runtime callers fall back, never crash);
`evalFormula(compiled, env)` with `env = { a, b, v(n), randomInt(n) }` → number,
`NaN → 0`, clamped ≥ 0 (MZ's `Math.max(eval, 0)` + `isNaN` guard). Plus the pure MZ
damage pipeline, byte-order-faithful to `Game_Action`:

- `mzApplyVariance(damage, variancePct, randomInt)` — `amp = floor(|damage|·var/100)`;
  `v = randomInt(amp+1) + randomInt(amp+1) − amp`; `damage ≥ 0 ? damage+v : damage−v`.
- `mzDamageValue({ base, elementRate, critical, variance, guarding, randomInt })` —
  `value = base × elementRate` → (pdr/mdr/rec = 1 until M3·B) → crit ×3 → variance →
  guard ÷ 2 (MZ `applyGuard`, `grd` = 1 until M3·B, damage > 0 only) → `Math.round`.
- `mzHitRoll({ hitPct, evadePct, rndf })` — MZ order (miss roll, then evade roll),
  **consuming a draw only when the corresponding chance is real** (`hitPct == null`
  ⇒ no miss roll; `evadePct ≤ 0` ⇒ no evade roll) so native projects' RNG streams
  never shift.

Conscious deviations (kid-friendlier than MZ's raw `eval`, recorded for the M6·C grade):
`v[n]` of an untouched variable reads 0 (MZ reads raw `_data` → `undefined` → the whole
formula NaNs to 0); `b.level` on an enemy reads 0 (MZ throws → whole formula 0);
division by zero → `Infinity` → NaN-guarded to 0 at the boundary.

### Schema (all optional — FORMAT_VERSION stays 2, D2)

- `Skill`: `variance?: number` (0–100), `critical?: boolean` (can crit ×3, MZ),
  `dmgType?: "mp" | "hpDrain" | "mpDrain"` (MZ damage type 2/5/6; absent = plain HP),
  `powerPct?: number` (heals add this % of the target's max HP — MZ effect 11 value1).
- `Item`: `variance?: number`, `hpPct?: number`, `mpPct?: number` (effect 11/12 value1).
- `Skill.formula` / `Item.formula` already exist (stored verbatim since M1·A, D1).

### Importer flips (`convert-items.ts`, `traits.ts`)

- **Skills:** `damage.variance` → `variance` (when a formula is stored), `damage.critical`
  → `critical`, `damage.type` 2→`dmgType:"mp"`, 4→heal + `dmgType:"mp"`, 5→`"hpDrain"`,
  6→`"mpDrain"`; effect 11 `value1` → `powerPct` (rounded ×100). Formulas are now
  **parsed at import**: parseable → stored, works, and the old blanket "formulas turn on
  in a later update" todo line is gone; reject → formula kept verbatim (re-import
  upgrades it if a later phase widens the grammar) + **one aggregated `partial` report
  line** — the skill honestly falls back to simple damage (never silently zero, D1).
- **Items:** same formula validation; effect 11/12 `value1` → `hpPct`/`mpPct`; an
  *offensive* item formula (damage type 1/2/5/6) reports — Atlas's battle has no
  use-item-on-enemy flow yet.
- **Traits (`code 22` ex-params):** dataId 0/1/2 (hit/eva/cri) → Atlas `special` traits
  `hitChance`/`evadeChance`/`critChance` (percent, MZ-additive via `RA.traitSum`;
  `critChance` is the key the engine already reads). dataIds 3–9 stay on the
  "advanced battler bonuses" report until M3·B. Enemies still have no trait carrier
  (matrix: enemy `traits[]` → M3·B) — enemy-side element/eva/cri stay neutral this step.

### Battle glue (`battle.ts` + `menus.ts` — native paths byte-identical)

- Read-only facades: `actorFacade` via `param()`/live `hp`/`mp`/`level`;
  `enemyFacade` via `d.stats` + live battler `hp` (enemy `mp` lazily seeded from
  `stats.mmp` **outside** the extracted troop-setup statement pinned by
  `tests/battle-index.test.js`); `v(n)` → `G.vars[n] || 0`; `randomInt` → `rnd`.
- `resolveAction`, all four damage/heal branches: when the acting skill has a
  **compilable** `formula`, damage runs the MZ pipeline (element rate from the target
  class's element traits where a carrier exists; crit gated on `skill.critical` rolled
  against the attacker's `critChance` sum; `variance`; guard ÷2 for a guarding target);
  Atlas's row scale (front = ×1) still applies after, like every battle action. A
  formula that fails to compile at runtime (hand-edited JSON) falls back to the
  structured-power path — with `power` now `|| 0`-guarded, which also fixes the latent
  NaN for imported formula skills that had no flat effect (they dealt NaN damage since
  M1; unkillable-enemy bug).
- **Hit/evade:** physical actions roll MZ-style miss (attacker `hitChance` sum) and
  evade (defender `evadeChance` sum) — *only when the traits exist*, so Atlas-native
  battles consume zero extra draws and never miss, exactly as before. MISS/EVADE float
  text + plain log lines.
- **Drains & MP damage:** `dmgType:"hpDrain"` — dealt = `min(target hp, dmg)` (MZ
  clamp), attacker gains it; `"mpDrain"` — same over MP; `"mp"` — damage lands on MP
  (no KO from MP). Heal-type + `dmgType:"mp"` restores MP (MZ type 4).
- **Heals:** formula heals = MZ pipeline (variance; crit ×3 if flagged) **+** flat
  `power` (M1's effect-11 mapping) **+** `floor(mhp × powerPct/100)`; the powerPct term
  also joins the native heal path (absent = 0 = unchanged).
- **Items (`useItemOn`):** `hpPct`/`mpPct` add %-of-max recovery; a heal-type item
  formula evaluates with `a = b = target` (Atlas item use has no "user" battler —
  documented approximation) + `variance`.
- Basic **Attack** keeps the Atlas curve — MZ wires normal attacks to `Skills[1]` via
  trait 35 (attack skill), which is M3·B; hit/eva/cri traits *do* already apply to it.
- Pure-MZ pipeline scope note: Atlas's native `damageTaken`/`guardDamage`/
  `skillPowerRate` trait hooks do **not** fold into the formula path (no MZ trait maps
  to them; pdr/mdr/rec/grd arrive in M3·B).

### Editor

Skills form ("Effects & preview" sub-tab) gains an **Advanced damage** section: an
optional MZ-style formula input (live-validated by the shared parser with a
plain-language verdict — never scary output), Variance 0–100, and a "Can critical"
checkbox. Absent fields = the exact classic behavior; the preview note says the formula
overrides Power when set.

### Tests

- **vitest** `tests-unit/formula-eval.test.ts` (new, the flagship): grammar
  acceptance/rejection table (sandbox escapes: assignment, `constructor`/`__proto__`,
  bracket access on `a`/`b`, string literals, `Math.random`, unknown identifiers,
  `a.luk`, `&&`, statements); the D1-amendment limits (513-char formula, 33-deep
  nesting); determinism — same mulberry32 seed twice ⇒ identical damage;
  **hand-computed MZ reference vectors** for the full pipeline (fixture formulas
  `a.atk * 4 - b.def * 2` and `a.mat * 2 - b.mdf + v[3]` among them) with stubbed
  `randomInt` sequences, covering variance/crit/element/guard combinations and the
  variance boundary cases (0%, 20%, 100%); `mzHitRoll` draw-conservation (no
  traits ⇒ zero draws).
- **vitest** `mz-import-db.test.ts` extended: variance/critical/dmgType/powerPct/
  hpPct/mpPct stored from the fixtures; parse-reject → formula kept + partial report;
  class code-22 dataId 0 → `hitChance` special trait (fixture Wanderer has it); Slime's
  code-22 dataId 6 still reports (no enemy carrier).
- **node --test**: existing suites stay green — notably `battle-index.test.js`
  (troop-setup statement untouched) and `action-combat.test.js`.
- **Playwright**: full suite, **0 regressions** (map 1 goldens untouched). Formula
  combat itself is vitest-proven; the full-battle e2e lands with M3·C per the roadmap.

### Stage log

- **2026-07-05 — M3·A started (branch `mig-3a`).** Read roadmap phase M3, decision D1
  (+ gate amendments), matrix §5/§6/§7 + the "M3·A — formula" bill, `battle.ts`,
  `convert-items.ts`/`traits.ts`, and the fixture formulas. Wrote this spec. Design
  locked: pure `src/shared/formula.ts` (restricted-AST parser + MZ pipeline with
  injected RNG), optional-only schema fields, import-time formula validation with
  honest fallback, trait-gated hit/evade rolls (zero native RNG drift), drains/MP
  damage, %-recover, editor formula field. Implementation next.

- **2026-07-05 — M3·A complete (branch `mig-3a`).** Shipped the sandboxed
  damage-formula evaluator with MZ-compatible combat math:
  - **Evaluator:** new `src/shared/formula.ts` — restricted-AST recursive-descent
    parser + AST-walk evaluator exactly per D1 (whitelisted grammar, facades,
    `v[n]`, nine Math fns; strings/assignment/`&&`/`||`/unknown members all reject
    with plain-language errors), amendments enforced (injected `randomInt`; 512-char
    / 32-depth limits), plus the pure MZ pipeline `mzApplyVariance` /
    `mzDamageValue` (element → crit ×3 → variance → guard ÷2 → round) / `mzHitRoll`
    (draw-conserving miss-then-evade). Compile cache; rejects/`"0"` → `null` →
    structured-power fallback.
  - **Schema (optional-only, FORMAT_VERSION stays 2):** `Skill.{variance, critical,
    dmgType, powerPct}`, `Item.{variance, hpPct, mpPct}`.
  - **Importer:** formulas parse-validated at import — parseable ⇒ works (the old
    blanket "turn on in a later update" line is gone); reject ⇒ kept verbatim + one
    aggregated `partial` line + structured fallback. variance/critical travel with
    the formula; damage types 2/4/5/6 → `dmgType`; effect 11/12 `value1` →
    `powerPct`/`hpPct`/`mpPct`; offensive/MP-recover item formulas report honestly.
    `traits.ts` code 22 dataId 0/1/2 → `special` hitChance/evadeChance/critChance.
  - **Engine:** `battle.ts` formula path in all four damage/heal branches (facades
    snapshot `param()`/live HP/MP; enemy MP lazily seeded outside the pinned
    troop-setup statement), MZ order with guard ÷2, trait-gated MISS/EVADED rolls,
    HP/MP drains + MP damage, heal crits, `powerPct` %-of-max on both heal paths;
    `menus.ts` `useItemOn` returns the applied amounts and adds `hpPct`/`mpPct` +
    recovery-formula healing (a = b = target). Native paths byte-identical — the
    `Number(power) || 0` guards only change the previously-NaN case.
  - **Editor:** the skill form's Effects & preview tab gained an "Advanced damage"
    box (formula with live plain-language verdicts from the shared parser,
    Variance %, Can critical). Wiki `Battles-and-States.md` documents it;
    docs-site regenerated (also picking up M2's pending wiki edits).
  - **Tests:** new `tests-unit/formula-eval.test.ts` (55 tests: grammar table, 26
    sandbox rejects, amendment limits, mulberry32 determinism, hand-computed MZ
    reference vectors A1–C for variance/crit/element/guard/rounding, `mzHitRoll`
    draw-conservation, importer companions incl. drains + reject report);
    `mz-import-db.test.ts` extended (companions, hitChance trait, zero reject
    lines on the fixtures). **All green:** typecheck, eslint, 18 node suites,
    742 vitest, **69/69 Playwright (0 regressions, map 1 untouched)**.
  - **Fixture amendment (recorded like D10):** the Wanderer class ex-param hit
    trait `0.05 → 0.95` in both fixtures — the trait became *real* this step, and
    0.05 (a 95% miss rate, authored when code 22 was report-only) made the
    imported fixture battle unplayable; 0.95 is the MZ-default actor hit rate.
    Conversion coverage is unchanged (`hitChance 95` asserted in vitest).
  - **Latent-bug find:** pre-M3·A, imported formula skills had no `power`, so the
    enemy skill path dealt **NaN damage** — the import-boot battle e2e only
    "passed" because the party's HP went NaN and the battle insta-lost. With
    honest 0-damage math the troop-page message now really opens mid-battle, so
    the spec's Enter-driver also dismisses `.msgwin` (like player.spec's save
    confirmation). Both effects are the fix working, not regressions.
  - Patch notes added; `patch-notes.js?v=48→49` bumped in `help.ts` + `shims.d.ts`.
  - Scope notes for M3·B: enemies still have no trait carrier (enemy-side
    element/eva/cri neutral); basic Attack keeps the Atlas curve until trait 35;
    pdr/mdr/rec/grd sp-params fixed at 1; `&&`/`||` stay outside the D1 grammar
    without a new gate decision.

---

## M3·B — Trait & effect code coverage *(not started — spec lands with the step)*

## M3·C — Troop & enemy battle parity *(not started — spec lands with the step)*
