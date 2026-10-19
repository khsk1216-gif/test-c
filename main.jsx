import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createClient } from "@supabase/supabase-js";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Coins,
  LayoutDashboard,
  Menu,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wallet,
  X,
  Pencil,
  Repeat2,
  Target,
  Check,
  RefreshCw,
} from "lucide-react";
import {
  categories,
  money as won,
  dateKey,
  monthKey,
  validAmount,
  monthStats,
  syncGuest,
} from "./domain.mjs";
import { ensureSession } from "./session.mjs";
import "./style.css";
const url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY,
  db = url && key ? createClient(url, key) : null;
const guestKey = "moa-guest-v2",
  emptyData = () => ({ rows: [], budgets: [], rules: [] });
const emoji = {
  용돈: "🪙",
  아르바이트: "💼",
  간식: "🍪",
  식비: "🍜",
  교통: "🚌",
  쇼핑: "🛍️",
  문화생활: "🎟️",
  저축: "🐷",
  기타: "✨",
};
const tint = {
  용돈: "#d9f2e7",
  아르바이트: "#e5e1ff",
  간식: "#fff0d7",
  식비: "#ffe2dc",
  교통: "#deefff",
  쇼핑: "#fce0ed",
  문화생활: "#e9e5ff",
  저축: "#d6f1ee",
  기타: "#eceeea",
};
const freshForm = () => ({
  type: "expense",
  title: "",
  amount: "",
  category: "식비",
  date: dateKey(),
  memo: "",
  repeat: false,
  due_day: 1,
});
const friendly = (e) =>
  e?.message?.includes("Failed to fetch")
    ? "연결을 확인하고 다시 시도해 주세요."
    : "처리하지 못했어요. 잠시 후 다시 시도해 주세요.";

function Modal({ title, children, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const key = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        const items = [
            ...ref.current.querySelectorAll(
              "button:not([disabled]),input:not([disabled]),select:not([disabled])",
            ),
          ],
          first = items[0],
          last = items.at(-1);
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === ref.current)
        ) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <section
        className="modal"
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="닫기" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [ready, setReady] = useState(false),
    [guest, setGuest] = useState(false),
    [data, setData] = useState(emptyData),
    [loading, setLoading] = useState(false),
    [loadError, setLoadError] = useState("");
  const [month, setMonth] = useState(
      () => new Date(`${dateKey().slice(0, 7)}-01T12:00:00`),
    ),
    [page, setPage] = useState("dashboard"),
    [menu, setMenu] = useState(false);
  const [sessionError, setSessionError] = useState(""),
    [sessionAttempt, setSessionAttempt] = useState(0),
    [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(""),
    [modal, setModal] = useState(null),
    [form, setForm] = useState(freshForm),
    [formError, setFormError] = useState(""),
    [budgetInput, setBudgetInput] = useState(""),
    [filter, setFilter] = useState("all"),
    [category, setCategory] = useState("all"),
    [query, setQuery] = useState("");
  const generation = useRef(0),
    activeUser = useRef(null),
    busyRef = useRef(false);
  busyRef.current = busy;
  const safeData = guest || data.owner === user?.id ? data : emptyData();
  const ym = monthKey(month),
    stats = monthStats(safeData.rows, ym),
    budget = safeData.budgets.find((b) => b.month === `${ym}-01`)?.amount || 0,
    remaining = budget - stats.expense,
    ratio = budget ? Math.min(100, (stats.expense / budget) * 100) : 0;
  const visible = stats.current
    .filter(
      (r) =>
        (filter === "all" || r.type === filter) &&
        (category === "all" || r.category === category) &&
        `${r.title} ${r.category} ${r.memo || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        String(b.created_at || b.id).localeCompare(
          String(a.created_at || a.id),
        ),
    );
  useEffect(() => {
    let live = true;
    setSessionError("");
    setReady(false);
    if (!db) {
      enterGuest();
      setReady(true);
      return;
    }
    const {
      data: { subscription },
    } = db.auth.onAuthStateChange((event, session) => {
      if (!live) return;
      if (session) {
        setUser(session.user);
      } else if (event === "SIGNED_OUT") {
        generation.current++;
        activeUser.current = null;
        setUser(null);
        setData(emptyData());
        setSessionAttempt((n) => n + 1);
      }
    });
    ensureSession(db)
      .then((session) => {
        if (!live) return;
        setUser(session.user);
        setReady(true);
      })
      .catch(() => {
        if (!live) return;
        setSessionError(
          "기록 저장소에 연결하지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
        );
        setReady(true);
      });
    return () => {
      live = false;
      subscription.unsubscribe();
    };
  }, [sessionAttempt]);
  useEffect(() => {
    activeUser.current = user?.id || null;
  }, [user?.id]);
  useEffect(() => {
    if (guest || !user?.id) return;
    setData(emptyData());
    loadData(user.id);
    return () => {
      generation.current++;
    };
  }, [user?.id, guest]);
  useEffect(() => {
    if (guest)
      try {
        localStorage.setItem(guestKey, JSON.stringify(data));
      } catch {
        setNotice("브라우저 저장 공간이 부족해요. 저장 공간을 확인해 주세요.");
      }
  }, [data, guest]);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(t);
  }, [notice]);
  useEffect(() => {
    const refresh = () => {
      if (
        document.visibilityState === "visible" &&
        !guest &&
        user?.id &&
        !busyRef.current
      )
        loadData(user.id);
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [user?.id, guest]);
  async function loadData(id) {
    const run = ++generation.current;
    setLoading(true);
    setLoadError("");
    try {
      const sync = await db.rpc("moa_sync_recurring");
      if (sync.error) throw sync.error;
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const r = await db
          .from("transactions")
          .select("*")
          .eq("user_id", id)
          .eq("is_deleted", false)
          .order("id")
          .range(offset, offset + 999);
        if (r.error) throw r.error;
        rows.push(...r.data);
        if (r.data.length < 1000) break;
      }
      const [b, r] = await Promise.all([
        db.from("moa_budgets").select("*").eq("user_id", id),
        db
          .from("moa_recurring")
          .select("*")
          .eq("user_id", id)
          .order("created_at", { ascending: false }),
      ]);
      if (b.error) throw b.error;
      if (r.error) throw r.error;
      if (generation.current === run && activeUser.current === id)
        setData({ rows, budgets: b.data, rules: r.data, owner: id });
    } catch (e) {
      if (generation.current === run) setLoadError(friendly(e));
    } finally {
      if (generation.current === run) setLoading(false);
    }
  }
  function enterGuest() {
    let saved = emptyData();
    try {
      const p = JSON.parse(localStorage.getItem(guestKey));
      if (p && ["rows", "budgets", "rules"].every((k) => Array.isArray(p[k])))
        saved = p;
    } catch {}
    generation.current++;
    setData(syncGuest(saved));
    setGuest(true);
    setLoadError("");
    setLoading(false);
  }
  function openTransaction(row = null, repeat = false) {
    setForm(row ? { ...row, repeat: false } : { ...freshForm(), repeat });
    setFormError("");
    setModal("transaction");
    setMenu(false);
  }
  function openBudget() {
    setBudgetInput(String(budget || ""));
    setFormError("");
    setModal("budget");
    setMenu(false);
  }
  async function mutate(work, success) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFormError("");
    const id = user?.id;
    try {
      await work();
      if (!guest && activeUser.current === id) await loadData(id);
      setModal(null);
      setNotice(success);
    } catch (e) {
      setFormError(friendly(e));
    } finally {
      setBusy(false);
    }
  }
  function saveTransaction(e) {
    e.preventDefault();
    if (!validAmount(form.amount)) {
      setFormError("금액은 1~2,147,483,647원 사이의 정수로 입력해 주세요.");
      return;
    }
    if (!form.title.trim()) {
      setFormError("내역 이름을 입력해 주세요.");
      return;
    }
    const p = {
      title: form.title.trim(),
      amount: Number(form.amount),
      type: form.type,
      category: form.category,
      date: form.date,
      memo: form.memo.trim(),
    };
    mutate(
      async () => {
        if (form.repeat) {
          const { date, ...rest } = p,
            r = {
              ...rest,
              start_date: date,
              due_day: Number(form.due_day),
              active: true,
            };
          if (guest)
            setData((d) =>
              syncGuest({
                ...d,
                rules: [{ ...r, id: crypto.randomUUID() }, ...d.rules],
              }),
            );
          else {
            const q = await db
              .from("moa_recurring")
              .insert({ ...r, user_id: user.id });
            if (q.error) throw q.error;
          }
        } else if (guest)
          setData((d) => ({
            ...d,
            rows: form.id
              ? d.rows.map((r) => (r.id === form.id ? { ...r, ...p } : r))
              : [{ ...p, id: crypto.randomUUID() }, ...d.rows],
          }));
        else {
          const q = form.id
            ? await db
                .from("transactions")
                .update(p)
                .eq("id", form.id)
                .eq("user_id", user.id)
                .select("id")
                .single()
            : await db
                .from("transactions")
                .insert({ ...p, user_id: user.id })
                .select("id")
                .single();
          if (q.error) throw q.error;
        }
      },
      form.repeat
        ? "반복 내역을 등록했어요."
        : form.id
          ? "내역을 수정했어요."
          : "내역을 기록했어요.",
    );
  }
  function saveBudget(e) {
    e.preventDefault();
    if (!validAmount(budgetInput)) {
      setFormError("예산은 1원 이상의 정수로 입력해 주세요.");
      return;
    }
    mutate(async () => {
      const b = { month: `${ym}-01`, amount: Number(budgetInput) };
      if (guest)
        setData((d) => ({
          ...d,
          budgets: [...d.budgets.filter((x) => x.month !== b.month), b],
        }));
      else {
        const q = await db
          .from("moa_budgets")
          .upsert({ ...b, user_id: user.id }, { onConflict: "user_id,month" });
        if (q.error) throw q.error;
      }
    }, "이번 달 예산을 저장했어요.");
  }
  function deleteTransaction(row) {
    mutate(async () => {
      if (guest)
        setData((d) => ({
          ...d,
          rows: d.rows.map((r) =>
            r.id === row.id ? { ...r, is_deleted: true } : r,
          ),
        }));
      else {
        const q = await db
          .from("transactions")
          .update({ is_deleted: true })
          .eq("id", row.id)
          .eq("user_id", user.id)
          .select("id")
          .single();
        if (q.error) throw q.error;
      }
    }, "내역을 삭제했어요.");
  }
  function stopRule(rule) {
    mutate(async () => {
      if (guest)
        setData((d) => ({
          ...d,
          rules: d.rules.map((r) =>
            r.id === rule.id ? { ...r, active: false } : r,
          ),
        }));
      else {
        const q = await db
          .from("moa_recurring")
          .update({ active: false })
          .eq("id", rule.id)
          .eq("user_id", user.id)
          .select("id")
          .single();
        if (q.error) throw q.error;
      }
    }, "반복을 종료했어요. 이미 기록된 내역은 유지돼요.");
  }
  const closeModal = () => {
    if (!busyRef.current) setModal(null);
  };
  if (sessionError)
    return (
      <div className="loading">
        <section className="session-error" role="alert">
          <Coins size={30} />
          <h1>잠시 연결을 확인해 주세요</h1>
          <p>{sessionError}</p>
          <button
            className="primary"
            onClick={() => setSessionAttempt((n) => n + 1)}
          >
            다시 연결하기
          </button>
        </section>
      </div>
    );
  if (!ready || (!guest && !user))
    return (
      <div className="loading" role="status">
        나만의 기록을 불러오는 중이에요…
      </div>
    );
  const name = "나",
    pages = {
      dashboard: "대시보드",
      history: "전체 내역",
      recurring: "반복 내역",
    };
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? "show" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Coins size={21} />
          </div>
          <b>모아</b>
          <span className="brand-caption">MY MONEY LOG</span>
        </div>
        <div className="nav-label">나의 용돈</div>
        {[
          [LayoutDashboard, "dashboard", "대시보드"],
          [Wallet, "history", "전체 내역"],
          [Repeat2, "recurring", "반복 내역"],
        ].map(([Icon, p, label]) => (
          <button
            className={`nav-item ${page === p ? "active" : ""}`}
            key={p}
            onClick={() => {
              setPage(p);
              setMenu(false);
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
        <button
          className="nav-item"
          onClick={openBudget}
          disabled={loading || !!loadError}
        >
          <Target size={18} /> 월 예산 설정
        </button>
        <div className="sidebar-tip">
          <div className="tip-icon">
            <Sparkles size={17} />
          </div>
          <strong>
            작은 지출도
            <br />
            나를 아는 기록이에요.
          </strong>
          <p>
            오늘 쓴 용돈을 기록하고
            <br />
            내일의 여유를 만들어 보세요.
          </p>
          <div className="tip-doodle">✳</div>
        </div>
        <div className="sidebar-bottom">
          <div className="avatar">{name[0].toUpperCase()}</div>
          <div className="user-info">
            <b>{name}</b>
            <span>
              {guest ? "브라우저에 자동 저장" : "나만의 기록 · 자동 저장"}
            </span>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="scrim"
          aria-label="메뉴 닫기"
          onClick={() => setMenu(false)}
        />
      )}
      <main className="main">
        <header className="topbar">
          <button
            className="icon-button mobile-toggle"
            aria-label="메뉴 열기"
            onClick={() => setMenu(!menu)}
          >
            <Menu size={20} />
          </button>
          <div className="crumb">
            내 공간 <ChevronRight size={14} /> <b>{pages[page]}</b>
          </div>
          <div className="top-actions">
            <span>
              <CalendarDays size={15} />
              {dateKey().replaceAll("-", ". ")}
            </span>
            <button
              className="icon-button"
              aria-label="새로고침"
              disabled={loading || busy}
              onClick={() =>
                guest ? setData((d) => syncGuest(d)) : loadData(user.id)
              }
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
            </button>
            <div className="top-avatar">{name[0].toUpperCase()}</div>
          </div>
        </header>
        <div className="content">
          <div className="guest-banner">
            <span>
              가입 없이 바로 기록하세요. 같은 브라우저에서 기록이 이어져요.
              <br />
              브라우저 데이터를 지우면 기존 기록에 다시 접근할 수 없어요.
            </span>
          </div>
          <div className="welcome-row">
            <div>
              <div className="eyebrow">
                작은 기록, 여유로운 내일 <span>✳</span>
              </div>
              <h1>
                {page === "dashboard" ? "오늘의 용돈을 모아봐요" : pages[page]}{" "}
                {page === "dashboard" && <span>👋</span>}
              </h1>
              <p>
                {page === "recurring"
                  ? "매달 돌아오는 수입과 지출, 한 번에 관리해요."
                  : "내 용돈이 어디로 갔는지 가볍게 살펴봐요."}
              </p>
            </div>
            <button
              className="primary add-button"
              disabled={loading || !!loadError}
              onClick={() => openTransaction(null, page === "recurring")}
            >
              <Plus size={18} />
              {page === "recurring" ? "반복 등록" : "내역 추가"}
            </button>
          </div>
          {loadError && (
            <div className="load-error" role="alert">
              <span>{loadError}</span>
              <button className="text-button" onClick={() => loadData(user.id)}>
                다시 불러오기
              </button>
            </div>
          )}
          {page !== "recurring" && (
            <div className="month-control">
              <button
                className="icon-button"
                aria-label="이전 달"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft size={18} />
              </button>
              <b>
                {month.getFullYear()}년 {month.getMonth() + 1}월
              </b>
              <button
                className="icon-button"
                aria-label="다음 달"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight size={18} />
              </button>
              <button
                className="today-button"
                onClick={() =>
                  setMonth(new Date(`${dateKey().slice(0, 7)}-01T12:00:00`))
                }
              >
                이번 달
              </button>
            </div>
          )}
          {loading && (
            <div className="loading-note" role="status">
              기록을 불러오는 중이에요…
            </div>
          )}
          {page === "dashboard" && (
            <>
              <section className="summary-grid" aria-label="용돈 요약">
                {[
                  [
                    "전체 잔액",
                    stats.balance,
                    Wallet,
                    "balance-card",
                    "mint",
                    "모든 기간의 수입 − 지출",
                  ],
                  [
                    "이번 달 수입",
                    stats.income,
                    ArrowDownLeft,
                    "",
                    "green",
                    "선택한 달에 들어온 금액",
                  ],
                  [
                    "이번 달 지출",
                    stats.expense,
                    ArrowUpRight,
                    "",
                    "peach",
                    "선택한 달에 사용한 금액",
                  ],
                ].map(([label, value, Icon, cls, color, desc]) => (
                  <div className={`summary-card ${cls}`} key={label}>
                    <div className="card-top">
                      <span>{label}</span>
                      <div className={`summary-icon ${color}`}>
                        <Icon size={18} />
                      </div>
                    </div>
                    <div className="amount">
                      {loading ? "—" : `₩ ${won(value)}`}
                    </div>
                    <div className="card-foot">{desc}</div>
                  </div>
                ))}
              </section>
              <section className="budget-panel panel">
                <div className="budget-heading">
                  <div>
                    <span className="eyebrow">이번 달 소비 계획</span>
                    <h2>
                      {budget ? (
                        <>
                          예산이{" "}
                          <em className={remaining < 0 ? "over" : ""}>
                            {won(Math.abs(remaining))}원{" "}
                            {remaining < 0 ? "초과됐어요" : "남았어요"}
                          </em>
                        </>
                      ) : (
                        "이번 달, 얼마 안에서 써볼까요?"
                      )}
                    </h2>
                  </div>
                  <button
                    className="outline-button"
                    disabled={loading || !!loadError}
                    onClick={openBudget}
                  >
                    <Pencil size={14} />
                    {budget ? "예산 수정" : "예산 설정"}
                  </button>
                </div>
                <div
                  className={`progress ${remaining < 0 ? "over" : ""}`}
                  role="progressbar"
                  aria-label="월 예산 사용률"
                  aria-valuenow={Math.round(ratio)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <i style={{ width: `${ratio}%` }} />
                </div>
                <div className="budget-foot">
                  <span>
                    사용 <b>{won(stats.expense)}원</b>
                  </span>
                  <span>
                    {budget
                      ? `예산 ${won(budget)}원 · ${Math.round((stats.expense / budget) * 100)}% 사용`
                      : "예산을 정하면 남은 금액을 알려드려요"}
                  </span>
                </div>
              </section>
              <section className="dashboard-grid">
                <div className="panel chart-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>지출 흐름</h2>
                      <p>선택한 달의 5일 단위 지출이에요</p>
                    </div>
                    <span className="period">{month.getMonth() + 1}월</span>
                  </div>
                  <div className="chart-total">
                    <b>₩ {won(stats.expense)}</b>
                    <span>총 지출</span>
                  </div>
                  <div className="chart">
                    <div className="chart-guides">
                      <span>
                        ₩{won(Math.max(...stats.buckets.map((b) => b.value)))}
                      </span>
                      <span>₩0</span>
                    </div>
                    <div className="bar-area">
                      {stats.buckets.map((b) => (
                        <div className="bar-col" key={b.label}>
                          <div className="bar-wrap">
                            <div
                              className={`bar ${b.value ? "" : "empty"}`}
                              style={{
                                height: `${Math.max(3, (b.value / Math.max(...stats.buckets.map((x) => x.value), 1)) * 100)}%`,
                              }}
                              title={`${b.label}: ${won(b.value)}원`}
                              role="img"
                              aria-label={`${b.label} 지출 ${won(b.value)}원`}
                            />
                          </div>
                          <span>{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="panel insight-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>어디에 썼을까요?</h2>
                      <p>항목별 지출 비중을 살펴봐요</p>
                    </div>
                    <Sparkles size={18} />
                  </div>
                  <div className="category-stats">
                    {stats.byCategory.length ? (
                      stats.byCategory.map(([c, amount]) => (
                        <div className="category-stat" key={c}>
                          <div>
                            <span>
                              {emoji[c]} {c}
                            </span>
                            <b>
                              {won(amount)}원{" "}
                              <small>
                                {Math.round((amount / stats.expense) * 100)}%
                              </small>
                            </b>
                          </div>
                          <div className="progress">
                            <i
                              style={{
                                width: `${(amount / stats.expense) * 100}%`,
                                background: tint[c] || "#cce4d5",
                              }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="mini-empty">
                        첫 지출을 기록하면
                        <br />
                        나의 소비 패턴이 보여요.
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </>
          )}
          {page !== "recurring" ? (
            <section className="panel history-panel">
              <div className="history-heading">
                <div>
                  <h2>{page === "dashboard" ? "이번 달 내역" : "전체 내역"}</h2>
                  <p>
                    {month.getMonth() + 1}월 · {visible.length}건의 기록
                  </p>
                </div>
              </div>
              <div className="history-tools">
                <div className="tabs">
                  {[
                    ["전체", "all"],
                    ["수입", "income"],
                    ["지출", "expense"],
                  ].map(([label, value]) => (
                    <button
                      key={value}
                      className={filter === value ? "selected" : ""}
                      onClick={() => setFilter(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="filter-tools">
                  <select
                    aria-label="카테고리 필터"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">모든 항목</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <div className="search-box">
                    <Search size={15} />
                    <input
                      aria-label="내역 검색"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="내역 검색"
                    />
                  </div>
                </div>
              </div>
              <div className="transactions">
                {visible.length
                  ? visible.map((r) => (
                      <div className="transaction" key={r.id}>
                        <div
                          className="category-icon"
                          style={{ background: tint[r.category] || tint.기타 }}
                        >
                          {emoji[r.category] || "✨"}
                        </div>
                        <div className="transaction-name">
                          <b>
                            {r.title}{" "}
                            {r.recurring_id && (
                              <Repeat2 size={12} aria-label="반복 내역" />
                            )}
                          </b>
                          <span>
                            {r.category} <i>·</i>{" "}
                            {r.date.slice(5).replace("-", "월 ")}일
                            {r.memo && ` · ${r.memo}`}
                          </span>
                        </div>
                        <div className={`transaction-amount ${r.type}`}>
                          {r.type === "income" ? "+" : "−"} ₩{won(r.amount)}
                        </div>
                        <button
                          className="row-action"
                          aria-label={`${r.title} 수정`}
                          disabled={busy || loading}
                          onClick={() => openTransaction(r)}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          className="row-action danger"
                          aria-label={`${r.title} 삭제`}
                          disabled={busy || loading}
                          onClick={() => {
                            setFormError("");
                            setModal({ kind: "delete", row: r });
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))
                  : !loading && (
                      <div className="empty-state">
                        <div>🧾</div>
                        <b>
                          {query || filter !== "all" || category !== "all"
                            ? "조건에 맞는 기록이 없어요"
                            : "아직 기록이 없어요"}
                        </b>
                        <p>수입과 지출을 하나씩 기록해 보세요.</p>
                        <button
                          className="text-button"
                          disabled={!!loadError}
                          onClick={() => openTransaction()}
                        >
                          첫 내역 추가하기 <ChevronRight size={15} />
                        </button>
                      </div>
                    )}
              </div>
            </section>
          ) : (
            <section className="panel recurring-panel">
              <div className="recurring-info">
                <Repeat2 size={20} />
                <div>
                  <b>매달 같은 날, 자동으로 기록해요.</b>
                  <p>
                    접속할 때 오늘까지 도래한 내역을 한 번씩 반영해요.
                    <br />
                    29~31일이 없는 달에는 그달의 마지막 날에 기록돼요.
                  </p>
                </div>
              </div>
              {safeData.rules.length ? (
                safeData.rules.map((r) => (
                  <div
                    className={`rule-row ${r.active ? "" : "stopped"}`}
                    key={r.id}
                  >
                    <div
                      className="category-icon"
                      style={{ background: tint[r.category] }}
                    >
                      {emoji[r.category]}
                    </div>
                    <div className="rule-name">
                      <b>
                        {r.title}{" "}
                        <span className="rule-badge">
                          {r.active ? "사용 중" : "종료"}
                        </span>
                      </b>
                      <p>
                        매월 {r.due_day}일 · {r.category} · {r.start_date}부터
                      </p>
                    </div>
                    <b className={r.type}>
                      {r.type === "income" ? "+" : "−"} {won(r.amount)}원
                    </b>
                    {r.active && (
                      <button
                        className="outline-button"
                        disabled={busy || loading}
                        onClick={() => {
                          setFormError("");
                          setModal({ kind: "stop", rule: r });
                        }}
                      >
                        종료
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  <div>🔁</div>
                  <b>매달 받는 용돈이 있나요?</b>
                  <p>정기 용돈이나 구독료를 등록해 보세요.</p>
                  <button
                    className="text-button"
                    disabled={loading || !!loadError}
                    onClick={() => openTransaction(null, true)}
                  >
                    반복 내역 등록 <Plus size={14} />
                  </button>
                </div>
              )}
            </section>
          )}
          <footer className="app-footer">
            <span>✳</span> 작은 기록이 모여 큰 습관이 돼요.
          </footer>
        </div>
      </main>
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="알림 닫기" onClick={() => setNotice("")}>
            <X size={14} />
          </button>
        </div>
      )}
      {modal === "transaction" && (
        <Modal
          title={
            form.id
              ? "내역 수정하기"
              : form.repeat
                ? "반복 내역 등록"
                : "내역 추가하기"
          }
          onClose={closeModal}
        >
          <form onSubmit={saveTransaction}>
            <div className="type-toggle">
              {[
                ["expense", "지출"],
                ["income", "수입"],
              ].map(([t, label]) => (
                <button
                  type="button"
                  key={t}
                  className={form.type === t ? `on ${t}-on` : ""}
                  onClick={() => setForm({ ...form, type: t })}
                >
                  {label}
                </button>
              ))}
            </div>
            <label>
              내역 이름
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: 점심 식사"
              />
            </label>
            <div className="form-row">
              <label>
                금액 (원)
                <input
                  required
                  inputMode="numeric"
                  type="number"
                  min={1}
                  max={2147483647}
                  step={1}
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                  placeholder="0"
                />
              </label>
              <label>
                {form.repeat ? "반복 시작일" : "날짜"}
                <input
                  required
                  type="date"
                  min="2000-01-01"
                  max="2100-12-31"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </label>
            </div>
            <label>
              카테고리
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              메모 (선택)
              <input
                maxLength={500}
                value={form.memo}
                onChange={(e) => setForm({ ...form, memo: e.target.value })}
                placeholder="간단한 메모를 남겨보세요"
              />
            </label>
            {!form.id && (
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={form.repeat}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      repeat: e.target.checked,
                      due_day: Number(form.date.slice(8)),
                    })
                  }
                />
                매달 반복하기
              </label>
            )}
            {form.repeat && (
              <>
                <label>
                  매월 기록할 날짜
                  <select
                    value={form.due_day}
                    onChange={(e) =>
                      setForm({ ...form, due_day: Number(e.target.value) })
                    }
                  >
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1}일
                      </option>
                    ))}
                  </select>
                </label>
                <p className="form-hint">
                  시작일 이후부터 오늘까지 도래한 내역이 반영돼요. 해당 날짜가
                  없는 달에는 말일에 기록돼요.
                </p>
              </>
            )}
            {formError && (
              <div className="error" role="alert">
                {formError}
              </div>
            )}
            <button className="primary save-button" disabled={busy}>
              {busy ? "저장 중…" : "저장하기"} <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal === "budget" && (
        <Modal
          title={`${month.getMonth() + 1}월 예산 설정`}
          onClose={closeModal}
        >
          <form onSubmit={saveBudget}>
            <p className="form-hint">
              이번 달 지출 목표를 정해 보세요. 매달 따로 설정할 수 있어요.
            </p>
            <label>
              월 예산 (원)
              <input
                required
                type="number"
                inputMode="numeric"
                min={1}
                max={2147483647}
                step={1}
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="예: 300000"
              />
            </label>
            {formError && (
              <div className="error" role="alert">
                {formError}
              </div>
            )}
            <button className="primary save-button" disabled={busy}>
              {busy ? "저장 중…" : "예산 저장"} <Check size={17} />
            </button>
          </form>
        </Modal>
      )}
      {modal?.kind === "delete" && (
        <Modal title="내역을 삭제할까요?" onClose={closeModal}>
          <p className="form-hint">
            ‘{modal.row.title}’ {won(modal.row.amount)}원 기록을 삭제해요.
            {modal.row.recurring_id && " 이 기록은 다시 자동 생성되지 않아요."}
          </p>
          {formError && (
            <div className="error" role="alert">
              {formError}
            </div>
          )}
          <div className="confirm-actions">
            <button
              className="outline-button"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => deleteTransaction(modal.row)}
            >
              {busy ? "처리 중…" : "삭제하기"}
            </button>
          </div>
        </Modal>
      )}
      {modal?.kind === "stop" && (
        <Modal title="이 내역의 반복을 종료할까요?" onClose={closeModal}>
          <p className="form-hint">
            ‘{modal.rule.title}’의 앞으로의 자동 기록을 종료해요. 이미 기록된
            내역은 유지돼요.
          </p>
          {formError && (
            <div className="error" role="alert">
              {formError}
            </div>
          )}
          <div className="confirm-actions">
            <button
              className="outline-button"
              disabled={busy}
              onClick={() => setModal(null)}
            >
              취소
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => stopRule(modal.rule)}
            >
              {busy ? "처리 중…" : "반복 종료"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
