export const categories = [
  "용돈",
  "아르바이트",
  "식비",
  "간식",
  "교통",
  "쇼핑",
  "문화생활",
  "저축",
  "기타",
];
export const money = (n) =>
  new Intl.NumberFormat("ko-KR").format(Number(n) || 0);
export const dateKey = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
export const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const validAmount = (v) =>
  Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 2147483647;
export function monthStats(rows, month) {
  const live = rows.filter((r) => !r.is_deleted),
    current = live.filter((r) => r.date.startsWith(month));
  const total = (items, type) =>
    items
      .filter((r) => r.type === type)
      .reduce((s, r) => s + Number(r.amount), 0);
  const buckets = Array.from({ length: 6 }, (_, i) => ({
      label: i === 5 ? "26일~말일" : `${i * 5 + 1}~${i * 5 + 5}일`,
      value: 0,
    })),
    cats = {};
  for (const r of current.filter((r) => r.type === "expense")) {
    buckets[Math.min(5, Math.floor((Number(r.date.slice(8)) - 1) / 5))].value +=
      Number(r.amount);
    cats[r.category] = (cats[r.category] || 0) + Number(r.amount);
  }
  return {
    current,
    income: total(current, "income"),
    expense: total(current, "expense"),
    balance: total(live, "income") - total(live, "expense"),
    buckets,
    byCategory: Object.entries(cats).sort((a, b) => b[1] - a[1]),
  };
}
export function recurringDate(month, day) {
  const [y, m] = month.split("-").map(Number);
  return `${month}-${String(Math.min(day, new Date(y, m, 0).getDate())).padStart(2, "0")}`;
}
export function syncGuest(data, today = dateKey()) {
  const rows = [...data.rows];
  for (const r of data.rules.filter((r) => r.active)) {
    let m = r.start_date.slice(0, 7);
    while (m <= today.slice(0, 7)) {
      const date = recurringDate(m, r.due_day);
      if (
        date >= r.start_date &&
        date <= today &&
        !rows.some(
          (x) => x.recurring_id === r.id && x.occurrence_month === `${m}-01`,
        )
      )
        rows.push({
          id: crypto.randomUUID(),
          title: r.title,
          amount: r.amount,
          type: r.type,
          category: r.category,
          memo: r.memo,
          date,
          recurring_id: r.id,
          occurrence_month: `${m}-01`,
          is_deleted: false,
        });
      const [y, n] = m.split("-").map(Number);
      m = n === 12 ? `${y + 1}-01` : `${y}-${String(n + 1).padStart(2, "0")}`;
    }
  }
  return { ...data, rows };
}
