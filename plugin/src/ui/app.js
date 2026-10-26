"use strict";

const $ = (id) => document.getElementById(id);
const form = $("filters");

let metric = "";
let offset = 0;
let sessionOffset = 0;
let selected = null;
let raw = false;
let generation = 0;
let activeTab = "all";

const num = (value) => Number(value || 0);
const fmt = (value) => num(value).toLocaleString();
const money = (value) =>
  value === null || value === undefined
    ? "Unknown"
    : "$" + num(value).toFixed(6);
const pct = (value) => (num(value) * 100).toFixed(1) + "%";
const cost = (summary) =>
  num(summary.request_count) > 0 &&
  summary.reported_cost_usd === null &&
  summary.estimated_cost_usd === null
    ? "Unknown"
    : money(summary.cost_usd);

const el = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
};

const button = (text, action, className = "btn") => {
  const node = el("button", text, className);
  node.type = "button";
  node.onclick = () => run(action);
  return node;
};

function setBanner(message, isError = false) {
  const node = $("error");
  if (!node) return;
  node.textContent = message || "";
  node.classList.toggle("is-error", Boolean(isError && message));
}

async function run(action) {
  try {
    setBanner("");
    await action();
  } catch (error) {
    setBanner(error.message || String(error), true);
  }
}

async function api(path, options) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let message = "HTTP " + response.status;
    try {
      message = (await response.json()).error || message;
    } catch {}
    throw new Error(message);
  }
  return response.json();
}

function params() {
  const p = new URLSearchParams();
  for (const [key, value] of new FormData(form)) {
    if (value && key !== "hideAuxiliary" && key !== "from" && key !== "to")
      p.set(key, String(value));
  }
  if (form.elements.preset.value === "custom") {
    for (const key of ["from", "to"]) {
      if (form.elements[key].value)
        p.set(key, new Date(form.elements[key].value + "Z").toISOString());
    }
  }
  p.set("hideAuxiliary", String(form.elements.hideAuxiliary.checked));
  if (metric) p.set("metric", metric);
  return p;
}

function renderActiveFilterStrip() {
  const root = $("activeFilterStrip");
  if (!root) return;
  root.replaceChildren();
  const p = params();
  for (const [key, value] of p.entries()) {
    if (key === "hideAuxiliary" && value === "true") continue;
    if (key === "preset" && value === "7d") continue;
    root.append(el("span", `${key}: ${value}`, "filter-chip"));
  }
}

function roleBadge(partType) {
  const b = el(
    "span",
    String(partType || "unknown")
      .replaceAll("_", " ")
      .toUpperCase(),
    "badge",
  );
  b.dataset.role = partType || "unknown";
  return b;
}

function statusBadge(status) {
  const b = el("span", status || "unknown", "status-badge");
  b.dataset.status = status || "unknown";
  return b;
}

function table(target, columns, rows) {
  const root = typeof target === "string" ? $(target) : target;
  if (!root) return;
  root.replaceChildren();
  if (!rows || !rows.length) {
    root.append(el("p", "No captured requests in this selection.", "empty"));
    return;
  }
  const t = el("table"),
    head = el("tr");
  columns.forEach((c) => head.append(el("th", c[0])));
  const thead = el("thead");
  thead.append(head);
  t.append(thead);
  const body = el("tbody");
  for (const row of rows) {
    const tr = el("tr");
    for (const c of columns) {
      const td = el("td"),
        value = c[1](row);
      if (c[2]) td.className = c[2];
      if (value instanceof Node) td.append(value);
      else td.textContent = String(value ?? "—");
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(body);
  root.append(t);
}

function roleNode(rows) {
  const list = rows || [];
  const root = el("details");
  const totalEst = list.reduce((acc, r) => acc + num(r.estimated_tokens), 0);
  root.append(
    el("summary", `Role estimates (${list.length} · ~${fmt(totalEst)} tok)`),
  );
  for (const row of list) {
    root.append(
      el(
        "p",
        `${row.direction} · ${row.role} / ${row.part_type}: ${fmt(row.estimated_tokens)} estimated tokens`,
      ),
    );
  }
  return root;
}

function renderRoleBars(target, rows) {
  const root = typeof target === "string" ? $(target) : target;
  if (!root) return;
  root.replaceChildren();
  const list = rows || [];
  if (!list.length) return;
  const total = Math.max(
    1,
    list.reduce((acc, r) => acc + num(r.estimated_tokens), 0),
  );
  for (const row of list) {
    const card = el("div", undefined, "role-bar-card");
    const top = el("div", undefined, "role-bar-top");
    const left = el("div");
    left.append(
      roleBadge(row.part_type),
      el("span", `${row.direction} · ${row.role}`, "muted"),
    );
    const share = num(row.estimated_tokens) / total;
    top.append(
      left,
      el("strong", `${fmt(row.estimated_tokens)} (${pct(share)})`, "mono"),
    );
    const bar = el("div", undefined, "bar"),
      fill = el("span");
    fill.style.width = `${Math.max(2, share * 100)}%`;
    bar.append(fill);
    card.append(top, bar);
    root.append(card);
  }
}

function roles(target, rows) {
  const list = rows || [];
  const total = Math.max(
    1,
    list.reduce((acc, r) => acc + num(r.estimated_tokens), 0),
  );
  table(
    target,
    [
      ["Direction", (r) => r.direction],
      ["Role", (r) => r.role],
      ["Part type", (r) => roleBadge(r.part_type)],
      ["Estimated tokens", (r) => fmt(r.estimated_tokens), "num"],
      ["Share (est.)", (r) => pct(num(r.estimated_tokens) / total), "num"],
      [
        "Characters",
        (r) => (r.char_count === undefined ? "—" : fmt(r.char_count)),
        "num",
      ],
    ],
    list,
  );
}

function chart(root, rows, key, label, isMoney = false) {
  const wrap = el("div", undefined, "chart-box"),
    head = el("div", undefined, "chart-header"),
    title = el("h3", label),
    sumVal = (rows || []).reduce((acc, r) => acc + num(r[key]), 0),
    totalBadge = el(
      "span",
      isMoney ? money(sumVal) : fmt(sumVal),
      "muted mono",
    ),
    bars = el("div", undefined, "chart");
  head.append(title, totalBadge);
  wrap.append(head, bars);
  const max = Math.max(1, ...(rows || []).map((r) => num(r[key])));
  for (const row of rows || []) {
    const bar = el("div");
    bar.style.height = Math.max(3, (num(row[key]) / max) * 100) + "%";
    const valText = isMoney ? money(row[key]) : fmt(row[key]);
    bar.title = `${row.bucket || row.model || ""} · ${label}: ${valText}`;
    bar.tabIndex = 0;
    bar.setAttribute("aria-label", bar.title);
    bars.append(bar);
  }
  if (!rows || !rows.length) bars.append(el("p", "No data", "muted"));
  root.append(wrap);
}

function tokenKey() {
  return (
    {
      input: "uncached_input_tokens",
      uncached_input: "uncached_input_tokens",
      output: "output_tokens",
      reasoning: "reasoning_tokens",
      cache_read: "cache_read_tokens",
      cache_write: "cache_write_tokens",
      total_input: "total_input_tokens",
      non_cache_total: "non_cache_tokens",
    }[metric] || "total_tokens"
  );
}

function cards(data) {
  const entries = [
    [
      "Today cost",
      cost(data.today),
      `${fmt(data.today.request_count)} reqs today`,
    ],
    [
      "This month cost",
      cost(data.month),
      `${fmt(data.month.request_count)} reqs this month`,
    ],
    [
      "Today tokens",
      fmt(data.today.total_tokens),
      `Gross in: ${fmt(data.today.total_input_tokens)}`,
    ],
    [
      "This month tokens",
      fmt(data.month.total_tokens),
      `Gross in: ${fmt(data.month.total_input_tokens)}`,
    ],
    [
      "Requests today",
      fmt(data.today.request_count),
      `Filtered total: ${fmt(data.totals.request_count)}`,
    ],
    [
      "Cache hit ratio",
      pct(data.totals.cache_hit_ratio),
      `Read: ${fmt(data.totals.cache_read_tokens)}`,
    ],
    [
      "Est. cache savings",
      money(data.totals.estimated_cache_savings_usd),
      `Write: ${fmt(data.totals.cache_write_tokens)}`,
    ],
    [
      "Error rate",
      pct(data.totals.error_rate),
      `Usage reported: ${fmt(data.totals.usage_request_count)}`,
    ],
  ];
  const root = $("cards");
  root.replaceChildren();
  for (const [label, value, sub] of entries) {
    const card = el("div", undefined, "card");
    card.append(
      el("span", label, "card-label"),
      el("strong", value),
      el("span", sub, "card-sub"),
    );
    root.append(card);
  }
}

function tiers(t) {
  const root = $("tiers");
  root.replaceChildren();
  const groups = [
    {
      tier: "1",
      title: "1단 · Tier 1 · Total Input / 총 입력 컨텍스트",
      headline: t.total_input_tokens,
      subtitle: "Gross input context (Uncached + Cache Read + Cache Write)",
      rows: [
        ["Gross input (total_input_tokens)", fmt(t.total_input_tokens)],
        ["Input + Cache Read", fmt(t.input_plus_cache_read_tokens)],
        ["Uncached input share", fmt(t.uncached_input_tokens)],
      ],
    },
    {
      tier: "2",
      title: "2단 · Tier 2 · Cache Usage / 캐시 사용량",
      headline: num(t.cache_read_tokens) + num(t.cache_write_tokens),
      subtitle: "Cache read + cache write tokens & estimated savings",
      rows: [
        ["Cache Read tokens", fmt(t.cache_read_tokens)],
        ["Cache Write tokens", fmt(t.cache_write_tokens)],
        ["Cache Hit Ratio", pct(t.cache_hit_ratio)],
        ["Est. Cache Savings", money(t.estimated_cache_savings_usd)],
      ],
    },
    {
      tier: "3",
      title: "3단 · Tier 3 · Non-Cache Usage / 순수 비캐시 사용량",
      headline: t.non_cache_tokens,
      subtitle: "Uncached input + visible output + reasoning tokens",
      rows: [
        ["Uncached Input (순수 입력)", fmt(t.uncached_input_tokens)],
        ["Non-Cache Total (In + Out + Rsn)", fmt(t.non_cache_tokens)],
        ["Output tokens", fmt(t.output_tokens)],
        ["Reasoning tokens", fmt(t.reasoning_tokens)],
      ],
    },
  ];
  const max = Math.max(1, ...groups.map((g) => num(g.headline)));
  for (const g of groups) {
    const node = el("div", undefined, "tier");
    node.dataset.tier = g.tier;
    node.append(
      el("h3", g.title),
      el("strong", fmt(g.headline), "tier-headline"),
      el("p", g.subtitle, "muted"),
    );
    const bar = el("div", undefined, "bar"),
      fill = el("span");
    fill.style.width = (num(g.headline) / max) * 100 + "%";
    bar.append(fill);
    node.append(bar);
    const kvList = el("div", undefined, "tier-kv-list");
    for (const [k, v] of g.rows) {
      const row = el("div", undefined, "tier-kv");
      row.append(el("span", k, "muted"), el("span", v));
      kvList.append(row);
    }
    node.append(kvList);
    root.append(node);
  }

  const stackBar = $("tierStackBar"),
    stackLegend = $("tierStackLegend"),
    stackSummary = $("tierStackSummary");
  if (stackBar && stackLegend) {
    stackBar.replaceChildren();
    stackLegend.replaceChildren();
    const parts = [
      ["Cache Read", num(t.cache_read_tokens), "var(--c-cache-read)"],
      ["Cache Write", num(t.cache_write_tokens), "var(--c-cache-write)"],
      ["Uncached Input", num(t.uncached_input_tokens), "var(--c-uncached)"],
      ["Output", num(t.output_tokens), "var(--c-output)"],
      ["Reasoning", num(t.reasoning_tokens), "var(--c-reasoning)"],
    ];
    const total = Math.max(1, num(t.total_tokens));
    if (stackSummary)
      stackSummary.textContent = `Total tokens: ${fmt(t.total_tokens)}`;
    for (const [label, value, color] of parts) {
      const seg = el("div", undefined, "stack-seg");
      seg.style.width = (value / total) * 100 + "%";
      seg.style.background = color;
      seg.title = `${label}: ${fmt(value)} (${pct(value / total)})`;
      stackBar.append(seg);

      const item = el("span", undefined, "legend-item"),
        swatch = el("span", undefined, "legend-swatch");
      swatch.style.background = color;
      item.append(
        swatch,
        el("span", `${label}: ${fmt(value)} (${pct(value / total)})`),
      );
      stackLegend.append(item);
    }
  }
}

const usageColumns = [
  ["Requests", (r) => fmt(r.request_count), "num"],
  ["Gross input (T1)", (r) => fmt(r.total_input_tokens), "num"],
  ["Input + read", (r) => fmt(r.input_plus_cache_read_tokens), "num"],
  ["Cache read (T2)", (r) => fmt(r.cache_read_tokens), "num"],
  ["Cache write", (r) => fmt(r.cache_write_tokens), "num"],
  ["Hit %", (r) => pct(r.cache_hit_ratio), "num"],
  ["Uncached in (T3)", (r) => fmt(r.uncached_input_tokens), "num"],
  ["Non-cache total", (r) => fmt(r.non_cache_tokens), "num"],
  ["Output", (r) => fmt(r.output_tokens), "num"],
  ["Reasoning", (r) => fmt(r.reasoning_tokens), "num"],
  ["Cost¹", (r) => cost(r), "num"],
  ["Roles (estimated)", (r) => roleNode(r.role_breakdown)],
];

function renderOverview(data) {
  cards(data);
  tiers(data.totals);
  renderRoleBars("roleBars", data.role_breakdown);
  roles("roles", data.role_breakdown);
  const dailyCharts = $("dailyCharts");
  dailyCharts.replaceChildren();
  chart(dailyCharts, data.daily, "cost_usd", "Daily cost¹", true);
  chart(
    dailyCharts,
    data.daily,
    tokenKey(),
    "Daily tokens · " + (metric || "all"),
  );
  chart(dailyCharts, data.daily, "request_count", "Daily request count");

  const cacheChart = $("cacheChart");
  cacheChart.replaceChildren(
    el(
      "p",
      `Cache read ${fmt(data.totals.cache_read_tokens)} / Uncached input ${fmt(data.totals.uncached_input_tokens)} · Hit ratio ${pct(data.totals.cache_hit_ratio)}`,
    ),
  );
  const cacheBars = el("div", undefined, "bar"),
    fill = el("span");
  fill.style.width = num(data.totals.cache_hit_ratio) * 100 + "%";
  cacheBars.append(fill);
  cacheChart.append(cacheBars);

  table(
    "share",
    [
      ["Provider", (r) => r.provider],
      ["Model", (r) => r.model],
      ["Requests", (r) => fmt(r.request_count), "num"],
      ["Gross input", (r) => fmt(r.total_input_tokens), "num"],
      ["Output", (r) => fmt(r.output_tokens), "num"],
      ["Cost¹", (r) => money(r.cost_usd), "num"],
      [
        "Share",
        (r) =>
          pct(num(r.cost_usd) / Math.max(num(data.totals.cost_usd), 1e-20)),
        "num",
      ],
    ],
    data.provider_model_share,
  );

  const hourChart = $("hourChart");
  hourChart.replaceChildren();
  chart(
    hourChart,
    data.hourly,
    tokenKey(),
    "Hourly tokens (UTC) · " + (metric || "all"),
  );
  table(
    "hourly",
    [["Hour (UTC)", (r) => r.bucket], ...usageColumns],
    data.hourly,
  );
}

async function openSession(id) {
  form.elements.session.value = id;
  offset = 0;
  sessionOffset = 0;
  await refresh();
  const detail = await api(
    "/api/sessions/" + encodeURIComponent(id) + "?" + params(),
  );
  const root = $("sessionDetail");
  root.replaceChildren();
  const head = el("div", undefined, "session-banner-head");
  head.append(
    el("h3", "Session " + id),
    button("Clear session filter", async () => {
      form.elements.session.value = "";
      root.replaceChildren();
      await refresh();
    }),
  );
  const summary = detail.overview;
  root.append(
    head,
    el(
      "p",
      `${fmt(summary.request_count)} requests · Gross input ${fmt(summary.total_input_tokens)} · Cache read ${fmt(summary.cache_read_tokens)} · Non-cache ${fmt(summary.non_cache_tokens)} · Total ${fmt(summary.total_tokens)} tokens · Cost ${money(summary.cost_usd)}`,
    ),
    roleNode(detail.role_breakdown),
  );
}

function renderRequests(data) {
  table(
    "requests",
    [
      ["Timestamp", (r) => r.started_at],
      [
        "Project / Session",
        (r) =>
          button((r.project_id || "—") + " / " + r.session_id, () =>
            openSession(r.session_id),
          ),
      ],
      ["Kind", (r) => el("span", r.kind, "kind-badge")],
      ["Provider / Model", (r) => r.provider + " / " + r.model],
      ["Gross in (T1)", (r) => fmt(r.total_input_tokens), "num"],
      ["Cache read (T2)", (r) => fmt(r.cache_read_tokens), "num"],
      ["Cache write", (r) => fmt(r.cache_write_tokens), "num"],
      ["Uncached in (T3)", (r) => fmt(r.uncached_input_tokens), "num"],
      ["Non-cache", (r) => fmt(r.non_cache_tokens), "num"],
      ["Output", (r) => fmt(r.output_tokens), "num"],
      ["Reasoning", (r) => fmt(r.reasoning_tokens), "num"],
      [
        "Cost¹",
        (r) => money(r.reported_cost_usd ?? r.estimated_cost_usd),
        "num",
      ],
      [
        "Latency",
        (r) => (r.latency_ms === null ? "—" : fmt(r.latency_ms) + " ms"),
        "num",
      ],
      ["Status", (r) => statusBadge(r.status)],
      [
        "Inspect",
        (r) => button("Open", () => openRequest(r.id), "btn btn-primary"),
      ],
    ],
    data.items,
  );
  $("page").textContent =
    fmt(data.total) +
    " requests · " +
    (data.items.length ? offset + 1 : 0) +
    "–" +
    (offset + data.items.length);
  $("prev").disabled = offset === 0;
  $("next").disabled = offset + 25 >= num(data.total);
}

async function updateHealth() {
  try {
    const h = await api("/api/health");
    const dot = $("healthDot"),
      text = $("healthText");
    if (dot) dot.className = "status-dot ok";
    if (text) text.textContent = `DuckDB ${h.duckdb_version}`;
  } catch {
    const dot = $("healthDot"),
      text = $("healthText");
    if (dot) dot.className = "status-dot err";
    if (text) text.textContent = "Disconnected";
  }
}

async function refresh() {
  const current = ++generation,
    p = params();
  renderActiveFilterStrip();
  void updateHealth();
  const [overview, requests, sessions] = await Promise.all([
    api("/api/overview?" + p),
    api("/api/requests?" + p + "&limit=25&offset=" + offset),
    api("/api/sessions?" + p + "&limit=25&offset=" + sessionOffset),
  ]);
  if (current !== generation) return;
  renderOverview(overview);
  renderRequests(requests);
  table(
    "sessions",
    [
      ["Session", (r) => button(r.session_id, () => openSession(r.session_id))],
      ...usageColumns,
      ["Started", (r) => r.started_at],
      ["Last activity", (r) => r.completed_at],
    ],
    sessions.items,
  );
  $("sessionPage").textContent = fmt(sessions.total) + " sessions";
  $("sessionPrev").disabled = sessionOffset === 0;
  $("sessionNext").disabled = sessionOffset + 25 >= num(sessions.total);
}

function payloadBlock(parent, value) {
  const text =
      typeof value === "string" ? value : JSON.stringify(value, null, 2),
    pre = el("pre"),
    actions = el("div", undefined, "payload-actions");
  let expanded = false;
  const update = () => {
    pre.textContent = expanded
      ? text
      : text.slice(0, 12000) +
        (text.length > 12000 ? "\n[display truncated]" : "");
  };
  update();
  parent.append(pre, actions);
  if (text.length > 12000) {
    actions.append(
      button("Expand / truncate", () => {
        expanded = !expanded;
        update();
      }),
    );
  }
  actions.append(
    button("Copy", async () => {
      await navigator.clipboard.writeText(text);
      setBanner("Copied to clipboard");
    }),
  );
}

async function openRequest(id) {
  selected = await api("/api/requests/" + encodeURIComponent(id));
  raw = false;
  renderDetail();
  $("inspector").scrollIntoView({ behavior: "auto", block: "start" });
}

function renderDetail() {
  const root = $("inspector");
  root.replaceChildren();
  if (!selected) return;

  const sticky = el("div", undefined, "inspector-sticky");
  const titleRow = el("div", undefined, "inspector-title-row");
  const leftTitle = el("div");
  leftTitle.append(
    el("h2", "Request Inspector · " + selected.id),
    el(
      "p",
      `${selected.provider} / ${selected.model} · session ${selected.session_id} · started ${selected.started_at}`,
      "muted",
    ),
  );
  const actions = el("div", undefined, "btn-row");
  actions.append(
    statusBadge(selected.status),
    el("span", selected.kind, "kind-badge"),
    button(
      raw ? "Show normalized parts" : "Show raw / structured JSON",
      () => {
        raw = !raw;
        renderDetail();
      },
      "btn btn-primary",
    ),
    button("Close", () => {
      selected = null;
      root.replaceChildren();
    }),
  );
  titleRow.append(leftTitle, actions);
  sticky.append(titleRow);

  const meta = el("div", undefined, "meta");
  const pills = [
    ["Tier 1 Gross input", fmt(selected.total_input_tokens), "pill pill-tier1"],
    [
      "Input + Cache Read",
      fmt(selected.input_plus_cache_read_tokens),
      "pill pill-tier1",
    ],
    ["Tier 2 Cache read", fmt(selected.cache_read_tokens), "pill pill-tier2"],
    ["Cache write", fmt(selected.cache_write_tokens), "pill pill-tier2"],
    ["Cache hit ratio", pct(selected.cache_hit_ratio), "pill pill-tier2"],
    [
      "Tier 3 Uncached input",
      fmt(selected.uncached_input_tokens),
      "pill pill-tier3",
    ],
    ["Non-cache total", fmt(selected.non_cache_tokens), "pill pill-tier3"],
    ["Output", fmt(selected.output_tokens), "pill"],
    ["Reasoning", fmt(selected.reasoning_tokens), "pill"],
    [
      "Latency",
      selected.latency_ms === null ? "—" : fmt(selected.latency_ms) + " ms",
      "pill",
    ],
  ];
  for (const [k, v, cls] of pills) meta.append(el("span", `${k}: ${v}`, cls));
  sticky.append(meta);
  root.append(sticky);

  root.append(
    el(
      "p",
      `OpenCode-accounted cost: ${money(selected.reported_cost_usd)} · Local estimated cost: ${money(selected.estimated_cost_usd)} · Est. cache savings: ${money(selected.estimated_cache_savings_usd)} · Cost source: ${selected.cost_source || "none"}`,
    ),
    el(
      "p",
      "¹ OpenCode-accounted costs may already use catalog estimates; no provider-billed provenance is exposed. Missing usage is not a reported zero.",
      "muted footnote",
    ),
  );

  if (raw) {
    payloadBlock(root, selected);
    return;
  }

  for (const part of selected.message_parts) {
    const collapsed = ["tool_def", "tool_result"].includes(part.part_type),
      block = el(collapsed ? "details" : "div", undefined, "block");
    block.dataset.role = part.part_type;
    const heading = el(collapsed ? "summary" : "div", undefined, "block-head");
    const left = el("div");
    left.append(
      roleBadge(part.part_type),
      el(
        "span",
        `${part.direction} · ${part.role}${part.tool_name ? " · tool: " + part.tool_name : ""}${part.tool_call_id ? " (" + part.tool_call_id + ")" : ""}`,
      ),
    );
    heading.append(
      left,
      el(
        "span",
        `~${fmt(part.estimated_tokens)} est. tokens · ${fmt(part.char_count)} chars`,
        "muted mono",
      ),
    );
    block.append(heading);
    payloadBlock(block, part.text ?? part.payload);
    root.append(block);
  }

  const roleBarsRoot = el("div", undefined, "role-bars"),
    roleRoot = el("div");
  roleRoot.id = "detailRoles";
  root.append(el("h3", "Estimated role attribution"), roleBarsRoot, roleRoot);
  renderRoleBars(roleBarsRoot, selected.role_breakdown);
  roles(roleRoot, selected.role_breakdown);
}

function setTab(tab) {
  activeTab = tab;
  document.querySelectorAll("#navTabs .nav-tab").forEach((btn) => {
    const isMatch = btn.dataset.tab === tab;
    btn.classList.toggle("active", isMatch);
    btn.setAttribute("aria-pressed", String(isMatch));
  });
  document.querySelectorAll("[data-section]").forEach((sec) => {
    const visible = tab === "all" || sec.dataset.section === tab;
    sec.classList.toggle("hidden", !visible);
  });
}

document.querySelectorAll("#navTabs .nav-tab").forEach((btn) => {
  btn.onclick = () => setTab(btn.dataset.tab);
});

$("quickRefresh").onclick = () => run(refresh);

$("resetFilters").onclick = () => {
  form.reset();
  form.elements.preset.value = "7d";
  form.elements.hideAuxiliary.checked = true;
  metric = "";
  offset = 0;
  sessionOffset = 0;
  for (const node of $("metrics").children)
    node.setAttribute("aria-pressed", String(node.dataset.metric === ""));
  $("sessionDetail").replaceChildren();
  run(refresh);
};

for (const inputName of ["from", "to"]) {
  form.elements[inputName].addEventListener("change", () => {
    if (form.elements[inputName].value) form.elements.preset.value = "custom";
  });
}

form.onsubmit = (event) => {
  event.preventDefault();
  offset = 0;
  sessionOffset = 0;
  run(refresh);
};

for (const [value, label] of [
  ["", "All"],
  ["input", "Input (uncached)"],
  ["output", "Output"],
  ["cache_read", "Cache read"],
  ["cache_write", "Cache write"],
  ["reasoning", "Reasoning"],
  ["total_input", "Gross input (Tier 1)"],
  ["non_cache_total", "Non-cache total (Tier 3)"],
]) {
  const b = button(label, async () => {
    metric = value;
    offset = 0;
    sessionOffset = 0;
    for (const node of $("metrics").children)
      node.setAttribute("aria-pressed", String(node === b));
    await refresh();
  });
  b.dataset.metric = value;
  b.setAttribute("aria-pressed", String(value === ""));
  $("metrics").append(b);
}

$("prev").onclick = () =>
  run(async () => {
    offset = Math.max(0, offset - 25);
    await refresh();
  });
$("next").onclick = () =>
  run(async () => {
    offset += 25;
    await refresh();
  });
$("sessionPrev").onclick = () =>
  run(async () => {
    sessionOffset = Math.max(0, sessionOffset - 25);
    await refresh();
  });
$("sessionNext").onclick = () =>
  run(async () => {
    sessionOffset += 25;
    await refresh();
  });

document.querySelectorAll("[data-export]").forEach((b) => {
  b.onclick = () => {
    location.href = "/api/export?" + params() + "&format=" + b.dataset.export;
  };
});

async function remove(selection, label) {
  if (!confirm("Permanently delete " + label + "? This cannot be undone."))
    return;
  await api("/api/data?" + selection, { method: "DELETE" });
  selected = null;
  $("inspector").replaceChildren();
  $("sessionDetail").replaceChildren();
  offset = 0;
  sessionOffset = 0;
  await refresh();
}

$("deleteAll").onclick = () =>
  run(() => remove("all=true", "all captured data"));
$("deleteSession").onclick = () =>
  run(() => {
    const session = form.elements.session.value;
    if (!session) throw new Error("Select or filter a session first");
    return remove(
      "session=" + encodeURIComponent(session),
      "session " + session,
    );
  });
$("deleteRequest").onclick = () =>
  run(() => {
    if (!selected) throw new Error("Open a request first");
    return remove(
      "request=" + encodeURIComponent(selected.id),
      "request " + selected.id,
    );
  });
$("retention").onclick = () =>
  run(async () => {
    const days = Number($("days").value);
    if (!confirm("Delete captured data older than " + days + " days?")) return;
    await api("/api/retention", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    });
    selected = null;
    $("inspector").replaceChildren();
    await refresh();
  });

run(refresh);
