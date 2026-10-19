import test from "node:test";
import assert from "node:assert/strict";
import {
  monthStats,
  recurringDate,
  syncGuest,
  dateKey,
  validAmount,
} from "../domain.mjs";
test("Korean day boundary", () =>
  assert.equal(dateKey(new Date("2026-10-18T15:00:00Z")), "2026-10-19"));
test("month end including leap February", () => {
  assert.equal(recurringDate("2026-02", 31), "2026-02-28");
  assert.equal(recurringDate("2028-02", 31), "2028-02-29");
  assert.equal(recurringDate("2026-04", 31), "2026-04-30");
});
test("totals exclude deleted rows and keep distinct daily buckets", () => {
  const r = monthStats(
    [
      { type: "income", amount: 100, date: "2026-09-01" },
      { type: "income", amount: 50, date: "2026-10-01" },
      { type: "expense", category: "식비", amount: 10, date: "2026-10-02" },
      { type: "expense", category: "식비", amount: 20, date: "2026-10-31" },
      { type: "expense", amount: 99, date: "2026-10-01", is_deleted: true },
    ],
    "2026-10",
  );
  assert.equal(r.balance, 120);
  assert.equal(r.income, 50);
  assert.equal(r.expense, 30);
  assert.deepEqual(
    r.buckets.map((x) => x.value),
    [10, 0, 0, 0, 0, 20],
  );
  assert.deepEqual(r.byCategory, [["식비", 30]]);
});
test("recurrence backfill is idempotent and does not revive deleted records", () => {
  const d = {
    rows: [],
    budgets: [],
    rules: [
      {
        id: "a",
        active: true,
        start_date: "2026-01-01",
        due_day: 31,
        title: "용돈",
        amount: 100,
        type: "income",
        category: "용돈",
        memo: "",
      },
    ],
  };
  let r = syncGuest(d, "2026-03-01");
  assert.deepEqual(
    r.rows.map((x) => x.date),
    ["2026-01-31", "2026-02-28"],
  );
  r.rows[0].is_deleted = true;
  r.rows[1].date = "2026-03-01";
  r = syncGuest(r, "2026-03-31");
  assert.equal(r.rows.length, 3);
  assert.equal(r.rows[0].is_deleted, true);
  assert.equal(syncGuest(r, "2026-03-31").rows.length, 3);
});
test("stopped and future rules do not materialize", () => {
  assert.equal(
    syncGuest(
      {
        rows: [],
        rules: [
          { active: false, start_date: "2026-01-01" },
          { active: true, start_date: "2027-01-01", due_day: 1 },
        ],
      },
      "2026-10-19",
    ).rows.length,
    0,
  );
});
test("amount validation rejects cents and invalid amounts", () => {
  for (const x of [0, -1, 1.5, "abc", 2147483648])
    assert.equal(validAmount(x), false);
  assert.equal(validAmount(1), true);
});
