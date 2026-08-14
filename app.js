/* USVEX static dashboard — single-wave (2025) national survey.
 * Vanilla JS + Plotly.js, no build step, no server. All filtering and
 * weighted aggregation happens client-side over data.js.
 *
 * Unlike the CalVEX dashboard this pattern is adapted from, USVEX has only
 * one survey year, so there is no "Year" dimension: the x-axis is the
 * selected demographic's categories instead of years, there is no line
 * chart (a single-year line would just be one point), and no legend is
 * needed (the x-axis tick labels already name each bar). */
"use strict";

const D = window.USVEX_DATA;
const N = D.WEIGHT.length;

// ---------------------------------------------------------------------------
// Demographic dimensions: column name -> display config.
// Unlike CalVEX's numeric-coded columns, these are already plain label
// strings in the source data, so no code->label lookup table is needed —
// the value itself is the label (optionally shortened for chart display
// via `chip`).
// ---------------------------------------------------------------------------
const DEMOGRAPHICS = {
  GENDER_NEW: {
    label: "Gender",
    order: ["Woman", "Man", "Non-binary, genderqueer, gender fluid, self describe"],
    chip: { "Non-binary, genderqueer, gender fluid, self describe": "Non-binary / self-described" }
  },
  LGB_3: {
    label: "Sexuality",
    order: ["Straight", "Lesbian or gay", "Bisexual or other identity"]
  },
  AGE_6: {
    label: "Age",
    order: ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]
  },
  RACE_5: {
    label: "Race/Ethnicity",
    order: ["White", "Black", "Hispanic", "Asian", "Other/multiple races"]
  },
  INCOME_QUINTILE: {
    label: "Household Income",
    order: ["$0-$29,999", "$30,000-$59,999", "$60,000-$99,999", "$100,000-$149,999", "$150,000 or more"]
  },
  EDUC_4: {
    label: "Education Level",
    order: ["Less than HS", "Completed HS/some college/AD", "BA/4yr college degree", "Graduate degree"]
  },
  EMPLOY_2: {
    label: "Employment Status",
    order: ["Employed", "Not employed"]
  },
  DISABILITY: {
    label: "Disability Status",
    order: ["No Disability", "Has Disability"]
  },
  MARITAL: {
    label: "Marital Status",
    order: ["Married", "Widowed", "Divorced", "Separated", "Never married"]
  },
  HOUSING: {
    label: "Home Ownership",
    order: ["Owned or being bought by you or someone in your household", "Rented for cash", "Occupied without payment of cash rent"],
    chip: {
      "Owned or being bought by you or someone in your household": "Owned",
      "Rented for cash": "Rented for cash",
      "Occupied without payment of cash rent": "Occupied, no cash rent"
    }
  },
  IDEO: {
    label: "Political Ideology",
    order: ["Very liberal", "Somewhat liberal", "Moderate", "Somewhat conservative", "Very conservative"]
  },
  REGION4: {
    label: "US Region",
    order: ["Northeast", "Midwest", "South", "West"]
  },
  METRO: {
    label: "Metro/Non-Metro",
    order: ["Metro Area", "Non-Metro Area"]
  }
};

// Demographics with more/longer category labels get angled x-axis ticks.
const DENSE_DEMOGRAPHICS = new Set(["AGE_6", "RACE_5", "INCOME_QUINTILE", "EDUC_4", "IDEO", "HOUSING"]);

const SIDEBAR_DEMO_GROUPS = [
  "GENDER_NEW", "LGB_3", "AGE_6", "RACE_5", "MARITAL",
  "INCOME_QUINTILE", "HOUSING", "EDUC_4", "EMPLOY_2", "DISABILITY", "IDEO"
];
const SIDEBAR_LOCATION_GROUPS = ["REGION4", "METRO"];

function chipLabel(demKey, raw) {
  const chip = DEMOGRAPHICS[demKey].chip;
  return (chip && chip[raw]) || raw;
}

// ---------------------------------------------------------------------------
// Topics: outcome column per time period, plus past-year subcategory config.
// `ever: null` means the topic has no lifetime measure in the source data
// (sexual violence perpetration was only asked about the past year) — the
// UI disables the Lifetime option for those topics.
// ---------------------------------------------------------------------------
const TOPICS = {
  physical: {
    title: "Physical Violence", isPerp: false,
    ever: "pv_ever", past_year: "pv_12mo",
    subcats: [
      { col: "pastyearpv1", title: "Physical abuse" },
      { col: "pastyearpv2", title: "Knife violence" },
      { col: "pastyearpv3", title: "Gun violence" }
    ]
  },
  sexual: {
    title: "Sexual Violence", isPerp: false,
    ever: "sv_ever", past_year: "sv_12mo",
    subcats: [
      { col: "pastyearsv1", title: "Verbal sexual harassment" },
      { col: "pastyearsv2", title: "Homophobic or transphobic comments" },
      { col: "pastyearsv3", title: "Cyber sexual harassment" },
      { col: "pastyearsv4", title: "Physically aggressive sexual harassment" },
      { col: "pastyearsv5", title: "Quid pro quo sexual harassment or coercion" },
      { col: "pastyearsv6", title: "Forced sex" }
    ]
  },
  ipv: {
    title: "Intimate Partner Violence", isPerp: false,
    ever: "IPV25_EVER", past_year: "IPV25_YEAR",
    subcats: [
      { col: "IPV_E_12mo", title: "Emotional abuse" },
      { col: "IPV_C_12mo", title: "Coercive control" },
      { col: "IPV_T_12mo", title: "Threats" },
      { col: "IPV_P_12mo", title: "Physical violence" },
      { col: "IPV_L_12mo", title: "Severe / life-threatening violence" },
      { col: "IPV_S_12mo", title: "Sexual violence" },
      { col: "IPV_R_12mo", title: "Reproductive coercion" }
    ]
  },
  sexual_perp: {
    title: "Sexual Violence Perpetration", isPerp: true,
    ever: null, past_year: "sv_perp_12mo",
    subcats: [
      { col: "pastyearperpsv1", title: "Perpetrated verbal sexual harassment" },
      { col: "pastyearperpsv2", title: "Perpetrated homophobic or transphobic comments" },
      { col: "pastyearperpsv3", title: "Perpetrated cyber sexual harassment" },
      { col: "pastyearperpsv4", title: "Perpetrated physically aggressive sexual harassment" },
      { col: "pastyearperpsv5", title: "Perpetrated quid pro quo sexual harassment or coercion" },
      { col: "pastyearperpsv6", title: "Perpetrated forced sex" }
    ]
  },
  physical_perp: {
    title: "Physical Violence Perpetration", isPerp: true,
    ever: "pv_perp_ever", past_year: "pv_perp_12mo",
    subcats: [
      { col: "pastyearperppv1", title: "Perpetrated physical abuse" },
      { col: "pastyearperppv2", title: "Perpetrated knife violence" },
      { col: "pastyearperppv3", title: "Perpetrated gun violence" }
    ]
  }
};

// Base outcome name used in title-building (perp topics drop "Perpetration").
const BASE_TITLE = {
  physical: "Physical Violence", sexual: "Sexual Violence", ipv: "Intimate Partner Violence",
  sexual_perp: "Sexual Violence", physical_perp: "Physical Violence"
};

// Matches the CalVEX dashboard's purple palette per request.
const PALETTE = ["#CEA9EA", "#B08FD4", "#8E6FB0", "#6b558e", "#4A3D66", "#3d2d52"];
const OVERALL_COLOR = "#5c5c5c";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
function defaultFilters() {
  const f = {};
  for (const k of Object.keys(DEMOGRAPHICS)) f[k] = DEMOGRAPHICS[k].order.slice();
  return f;
}

function defaultState() {
  return {
    time_period: "past_year",
    topic: "physical",
    demographic: "GENDER_NEW",
    statistics: "percent",
    overall: true,
    show_subcategories: false,
    scale_max: 40,
    count_max: null, // null = auto-fit to current data
    filters: defaultFilters()
  };
}
let state = defaultState();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function comma(x) { return x.toLocaleString("en-US"); }
function pctLabel(p) { return String(Number(p.toFixed(1))) + "%"; }

function filteredIndices() {
  const s = state;
  const out = [];
  for (let i = 0; i < N; i++) {
    let ok = true;
    for (const k of Object.keys(DEMOGRAPHICS)) {
      const sel = s.filters[k];
      const val = D[k][i];
      // A row with no value for dimension k (missing/skipped in the survey)
      // has no checkbox representing it in that filter group, so it must
      // not be excluded by k's filter — otherwise missingness in ANY one
      // dimension (e.g. political ideology) would silently drop that
      // respondent from every OTHER comparison too (gender, region, etc.),
      // shrinking "Overall" and every subgroup's true denominator.
      if (val !== null && sel.length > 0 && !sel.includes(val)) { ok = false; break; }
    }
    if (ok) out.push(i);
  }
  return out;
}

// Weighted summary of one outcome column by demographic category (+ Overall).
// pct = sum(weight * (col==1)) / sum(weight) * 100 per group; n_total and
// raw count are unweighted.
function summarize(idx, vcol, demKey, showOverall) {
  const col = D[vcol], dcol = D[demKey], w = D.WEIGHT;
  const groups = new Map();
  const acc = (label, v, wt) => {
    let g = groups.get(label);
    if (!g) { g = { label, n_total: 0, count: 0, wcount: 0, wtotal: 0 }; groups.set(label, g); }
    g.n_total += 1;
    g.wtotal += wt;
    if (v === 1) { g.count += 1; g.wcount += wt; }
  };
  for (const i of idx) {
    const v = col[i];
    if (v === null) continue;
    if (showOverall) acc("Overall", v, w[i]);
    const cat = dcol[i];
    if (cat !== null) acc(cat, v, w[i]);
  }
  const recs = [];
  for (const g of groups.values()) {
    g.pct = g.wtotal > 0 ? (g.wcount / g.wtotal) * 100 : 0;
    recs.push(g);
  }

  const sel = state.filters[demKey];
  const keep = new Set(showOverall ? ["Overall"] : []);
  if (sel.length > 0) for (const c of sel) keep.add(c);
  return recs.filter(r => keep.has(r.label));
}

function levelOrder(recs, demKey, showOverall) {
  const present = new Set(recs.map(r => r.label));
  const levels = [];
  if (showOverall && present.has("Overall")) levels.push("Overall");
  for (const c of DEMOGRAPHICS[demKey].order) {
    if (present.has(c)) levels.push(c);
  }
  return levels;
}

function onlyOverallMode() {
  const sel = state.filters[state.demographic];
  return !sel || sel.length === 0;
}

function colorForIndex(level, i) {
  if (level === "Overall") return OVERALL_COLOR;
  return PALETTE[Math.min(i, PALETTE.length - 1)];
}

function buildTitle(onlyOverall) {
  const tp = state.time_period === "lifetime" ? "Lifetime" : "Past-Year";
  const topic = TOPICS[state.topic];
  const base = BASE_TITLE[state.topic];
  const stem = topic.isPerp ? `${tp} ${base} Perpetrated by` : `${tp} Experiences of ${base} by`;
  const group = onlyOverall ? "all respondents" : DEMOGRAPHICS[state.demographic].label;
  return `${stem} ${group}`;
}

function buildSubtitle() {
  const isPerp = TOPICS[state.topic].isPerp;
  const verb = isPerp ? "perpetrating" : "experiencing";
  const statLabel = state.statistics === "percent" ? `Percent ${verb} violence` : `Number ${verb} violence`;
  return `${statLabel} · 2025`;
}

function footnoteLines() {
  const lines = [
    "* Hover over a bar to see the raw count, shown as the number experiencing violence out of the total number of people surveyed in that group",
    "* We asked respondents about their experiences across their lifetime (“ever”) and also about their experiences in the past year"
  ];
  if (state.topic === "sexual_perp") {
    lines.push("* Sexual violence perpetration was only asked about for the past year, not lifetime");
  }
  if (state.time_period === "past_year" && state.statistics === "percent") {
    lines.push("* Past-year percent axes are scaled to fit the data; use the Y-axis max slider to adjust, or change to raw numbers for the unscaled count");
  }
  if (state.demographic === "METRO") {
    lines.push(
      "* Metro Area = counties within a federally defined Metropolitan Statistical Area (an urbanized core of 50,000+ residents plus its surrounding, economically linked counties); Non-Metro Area = all other counties"
    );
  }
  if (state.demographic === "REGION4") {
    lines.push("* Northeast: Connecticut, Maine, Massachusetts, New Hampshire, New Jersey, New York, Pennsylvania, Rhode Island, Vermont");
    lines.push("* Midwest: Illinois, Indiana, Iowa, Kansas, Michigan, Minnesota, Missouri, Nebraska, North Dakota, Ohio, South Dakota, Wisconsin");
    lines.push("* South: Alabama, Arkansas, Delaware, Florida, Georgia, Kentucky, Louisiana, Maryland, Mississippi, North Carolina, Oklahoma, South Carolina, Tennessee, Texas, Virginia, Washington D.C., West Virginia");
    lines.push("* West: Alaska, Arizona, California, Colorado, Hawaii, Idaho, Montana, Nevada, New Mexico, Oregon, Utah, Washington, Wyoming");
  }
  return lines;
}

function validationMessage() {
  if (state.filters.REGION4.length === 0) return "Please select at least one US region.";
  const categoriesUnselected = state.filters[state.demographic].length === 0;
  if (!state.overall && categoriesUnselected) {
    return `Please select at least one of "Overall" or ${DEMOGRAPHICS[state.demographic].label} labels`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Y-axis auto-fit helpers
// ---------------------------------------------------------------------------
function niceStep(v) {
  const raw = Math.max(1, v / 40);
  const pow = 10 ** Math.floor(Math.log10(raw));
  const m = raw / pow;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * pow;
}

function autoPercentMax(maxPct) {
  if (!isFinite(maxPct) || maxPct <= 0) return 20;
  const target = Math.ceil((maxPct * 1.15) / 5) * 5;
  return Math.min(100, Math.max(10, target));
}

function syncSlider(cfg) {
  const slider = document.getElementById("scale_max");
  slider.min = cfg.min;
  slider.max = cfg.max;
  slider.step = cfg.step;
  slider.value = cfg.value;
  document.getElementById("scale_max_unit").textContent = cfg.unit;
  document.getElementById("scale_max_value").textContent =
    cfg.unit === "n" ? comma(cfg.value) : String(cfg.value);
}

function countAxis(autoY) {
  const step = niceStep(autoY);
  const sliderMax = Math.ceil(autoY / step) * step;
  if (state.count_max !== null) state.count_max = Math.min(state.count_max, sliderMax);
  const top = state.count_max !== null ? state.count_max : sliderMax;
  syncSlider({ min: step, max: sliderMax, step, value: top, unit: "n" });
  return [0, top];
}

function percentAxis() {
  if (state.time_period !== "past_year") {
    return { range: [0, 107], tickvals: percentAxisBreaks(100) };
  }
  syncSlider({ min: 5, max: 100, step: 5, value: state.scale_max, unit: "%" });
  return { range: [0, state.scale_max + 5], tickvals: percentAxisBreaks(state.scale_max) };
}

function percentAxisBreaks(scaleMax) {
  const step = scaleMax <= 25 ? 5 : scaleMax <= 50 ? 10 : 20;
  const out = [];
  for (let v = 0; v <= scaleMax; v += step) out.push(v);
  return out;
}

// Recompute the percent slider's data-driven default and clear the count
// override. Called whenever topic / demographic / time period changes;
// filter-checkbox tweaks deliberately leave the slider where the user left
// it (so toggling a filter doesn't yank the axis around mid-comparison).
function resetSliderDefaults() {
  const topic = TOPICS[state.topic];
  const vcol = state.time_period === "lifetime" ? topic.ever : topic.past_year;
  if (vcol) {
    const idx = filteredIndices();
    const recs = summarize(idx, vcol, state.demographic, state.overall);
    const maxPct = Math.max(0, ...recs.map(r => r.pct));
    state.scale_max = autoPercentMax(maxPct);
  }
  state.count_max = null;
}

// ---------------------------------------------------------------------------
// Trace + layout construction
// ---------------------------------------------------------------------------
const HOVER_LABEL = {
  bgcolor: "#fff", bordercolor: "#ccc",
  font: { family: "Inter, sans-serif", size: 13, color: "#111" }
};

// Plain system font for the legend — always available, so Plotly's text
// measurements are correct on the very first draw. Plotly mis-measures
// label widths the first time it draws a webfont it hasn't seen yet, which
// leaves the color swatch drawn over the first letters of the label; a
// plain, always-loaded stack sidesteps that instead of chasing it with a
// relayout workaround.
const LEGEND_FONT = "Arial, sans-serif";

const PLOTLY_CONFIG = {
  responsive: true,
  displaylogo: false,
  // Keep hover (tooltips) as the only data-reveal interaction, plus
  // Plotly's native double-click-to-reset. Drag-to-zoom/pan and the
  // corner-resize handles are disabled below via dragmode/fixedrange, and
  // their toolbar buttons are removed so they're not even discoverable.
  modeBarButtonsToRemove: ["lasso2d", "select2d", "zoom2d", "pan2d", "zoomIn2d", "zoomOut2d", "autoScale2d", "resetScale2d"],
  toImageButtonOptions: { filename: "usvex-chart", scale: 2 }
};

// One trace per category (not one multi-color trace) — Plotly's legend
// gives one clickable entry per trace, so a real clickable legend needs
// each bar to be its own trace. Traces across every subcategory panel that
// represent the same category share a legendgroup, so clicking one legend
// entry toggles that category everywhere at once; only the first panel
// actually registers a legend entry (opts.showLegend), the rest ride along
// on the shared group so the legend isn't repeated once per panel.
function buildBarTraces(recs, levels, opts) {
  const isPerp = TOPICS[state.topic].isPerp;
  const verb = isPerp ? "perpetrating" : "experiencing";
  const xLabels = opts.xLabels || levels.map(lv => chipLabel(state.demographic, lv));

  return levels.map((lv, i) => {
    const r = recs.find(rec => rec.label === lv);
    if (!r) return null;
    const value = state.statistics === "percent" ? r.pct : r.count;
    const text = state.statistics === "percent" ? pctLabel(r.pct) : comma(r.count);
    const customdata = [[
      pctLabel(r.pct).replace("%", ""), comma(r.count), comma(r.n_total),
      `${chipLabel(state.demographic, lv)} ${verb} ${opts.vLabel}`
    ]];
    const hovertemplate =
      "<b>%{customdata[3]}</b><br>" +
      "Percentage: <b>%{customdata[0]}%</b><br>" +
      "Raw count: <b>%{customdata[1]}/%{customdata[2]}</b><extra></extra>";

    return {
      type: "bar",
      name: chipLabel(state.demographic, lv),
      legendgroup: lv,
      showlegend: opts.showLegend !== false,
      x: [xLabels[i]],
      y: [value],
      text: [text],
      textposition: "outside",
      textfont: { size: opts.denseLabels ? 10 : 11, family: "Inter, sans-serif", color: "#111" },
      marker: { color: colorForIndex(lv, i) },
      customdata,
      hovertemplate,
      hoverlabel: HOVER_LABEL,
      cliponaxis: true,
      xaxis: "x" + (opts.axisSuffix || ""),
      yaxis: "y" + (opts.axisSuffix || "")
    };
  }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const chartEl = document.getElementById("chart");
const validationEl = document.getElementById("validation-msg");

function isNarrow() { return window.innerWidth <= 768; }

function wrapTitle(text) {
  if (!isNarrow()) return { text, lines: 1 };
  const limit = Math.max(22, Math.floor((window.innerWidth - 30) / 8.5));
  const lines = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if (cur && (cur + " " + w).length > limit) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return { text: lines.join("<br>"), lines: lines.length };
}

// Word-wrap a single category label onto multiple lines (via <br>, which
// Plotly's tick/bar text renders as a real line break) instead of rotating
// it — keeps every x-axis label horizontal and still readable when the
// label is wider than the space one bar gets.
function wrapLabel(text, maxChars) {
  if (text.length <= maxChars) return text;
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > maxChars) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines.join("<br>");
}

// Rough estimate of how many characters fit on one line of a tick label,
// from the pixel width one bar actually gets (chart width / grid columns /
// bar count) and the tick font size — used to decide where wrapLabel()
// breaks each category name.
function tickCharBudget(totalWidthPx, columns, nCategories, fontSize) {
  const perBarPx = (totalWidthPx || 800) / Math.max(1, columns) / Math.max(1, nCategories);
  return Math.max(6, Math.floor(perBarPx / (fontSize * 0.62)));
}

// The page is one naturally-scrolling column now (chart, then the refine-
// population filters below it) rather than a chart pinned beside a
// fixed-height sidebar, so this just sizes the chart to a large-but-bounded
// share of the viewport instead of "whatever's left after the sidebar".
function mainChartHeight() {
  const floor = isNarrow() ? 380 : 420;
  const cap = isNarrow() ? 620 : 680;
  const reserve = isNarrow() ? 170 : 230;
  return Math.max(floor, Math.min(cap, window.innerHeight - reserve));
}

function showValidation(msg) {
  Plotly.purge(chartEl);
  chartEl.style.display = "none";
  validationEl.hidden = false;
  validationEl.textContent = msg;
}

function subcatsActive() {
  return state.show_subcategories && state.time_period === "past_year";
}

function renderMainChart(idx) {
  const s = state;
  const topic = TOPICS[s.topic];
  const vcol = s.time_period === "lifetime" ? topic.ever : topic.past_year;
  const recs = summarize(idx, vcol, s.demographic, s.overall);
  const levels = levelOrder(recs, s.demographic, s.overall);
  const onlyOverall = onlyOverallMode();
  const dense = DENSE_DEMOGRAPHICS.has(s.demographic);

  const fontSize = isNarrow() ? 10 : 12;
  const charBudget = tickCharBudget(chartEl.clientWidth, 1, levels.length, fontSize);
  const xLabels = levels.map(lv => wrapLabel(chipLabel(s.demographic, lv), charBudget));

  const traces = buildBarTraces(recs, levels, { vLabel: topic.title, denseLabels: dense, xLabels });
  const ax = s.statistics === "percent" ? percentAxis() : { range: countAxis(Math.max(0, ...recs.map(r => r.count)) * 1.15) };
  const yLab = s.statistics === "percent" ? "Percent Experiencing Violence (%)" : "Number Experiencing Violence";
  const wrapped = wrapTitle(buildTitle(onlyOverall));

  const layout = {
    dragmode: false,
    bargap: 0.35,
    font: { family: "Inter, sans-serif", color: "#111" },
    title: {
      text: `<b>${wrapped.text}</b>`,
      font: { size: isNarrow() ? 14 : 18 },
      x: 0.01, xanchor: "left",
      yref: "container", y: 0.97, yanchor: "top",
      subtitle: { text: buildSubtitle(), font: { size: 12, color: "#737373" } }
    },
    // A one-entry legend (just "Overall") is redundant with the title
    // already saying "all respondents", so it's dropped in that mode.
    // Paper-referenced (not container-referenced): with xref: "container"
    // Plotly reserves the legend's full width as side margin and squeezes
    // the plot area, instead of just floating above it.
    showlegend: !onlyOverall,
    legend: { orientation: "h", x: 1, xanchor: "right", y: 1.0, yanchor: "bottom", font: { size: 11, family: LEGEND_FONT } },
    xaxis: {
      title: { text: `<b>${DEMOGRAPHICS[s.demographic].label}</b>`, font: { size: 13 } },
      type: "category",
      categoryorder: "array",
      categoryarray: xLabels,
      tickfont: { size: fontSize },
      automargin: true,
      fixedrange: true,
      showgrid: false
    },
    yaxis: {
      title: { text: `<b>${yLab}</b>`, font: { size: 13 } },
      range: ax.range,
      gridcolor: "#e8eaee",
      zeroline: false,
      fixedrange: true,
      ...(ax.tickvals ? { tickvals: ax.tickvals } : { tickformat: "," })
    },
    margin: isNarrow()
      ? { t: 115 + (wrapped.lines - 1) * 18, r: 10, b: dense ? 90 : 50, l: 55 }
      : { t: 135, r: 20, b: dense ? 100 : 60, l: 75 },
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
    width: chartEl.clientWidth || undefined,
    height: mainChartHeight()
  };

  Plotly.react(chartEl, traces, layout, PLOTLY_CONFIG);
}

function renderSubcategories(idx) {
  const s = state;
  const topic = TOPICS[s.topic];
  const showOverall = s.overall;
  const onlyOverall = onlyOverallMode();
  const dense = DENSE_DEMOGRAPHICS.has(s.demographic);

  const panels = topic.subcats
    .map(item => ({ ...item, recs: summarize(idx, item.col, s.demographic, showOverall) }))
    .filter(p => p.recs.length > 0);
  if (panels.length === 0) { showValidation("No data for the current selection."); return; }

  // Uniform y-axis across all panels, cappable via the slider in both modes.
  let yRange, tickvals = null;
  if (s.statistics === "percent") {
    syncSlider({ min: 5, max: 100, step: 5, value: s.scale_max, unit: "%" });
    yRange = [0, s.scale_max + Math.max(5, Math.round(s.scale_max * 0.1))];
    tickvals = percentAxisBreaks(s.scale_max);
  } else {
    const globalMax = Math.max(1, ...panels.flatMap(p => p.recs.map(r => r.count)));
    yRange = countAxis(globalMax * 1.15);
  }

  // Grid the panels instead of stacking them in one long column, so
  // comparing subcategories doesn't require scrolling: up to 3 panels go in
  // a single row (3 columns); more wrap at 3 columns (6 panels -> 2 rows x
  // 3 columns, 7 panels -> 3 rows x 3 columns with the last cell empty).
  // Narrow/mobile viewports always fall back to a single column — a
  // 3-column grid would just make the bars too thin to read there,
  // defeating the point of gridding in the first place.
  const gridCols = isNarrow() ? 1 : Math.min(3, panels.length);
  const gridRows = Math.ceil(panels.length / gridCols);

  // Panel titles are positioned via "<axis> domain" y-refs, which are
  // fractions of THAT SUBPLOT's own height — not a fixed pixel gap. A
  // single-row grid gives its subplot the whole plot-area height, so a
  // fixed offset (e.g. 6%) pushes the title much further up in absolute
  // pixels than the same 6% would in a 3-row grid, where each subplot is a
  // third as tall. Left uncorrected, that's exactly what made the legend
  // and row-1 titles collide only in low-row-count grids (e.g. 3 panels =
  // 1 row) while 2-3 row grids looked fine. Scale the offset by each row's
  // actual height fraction (matching Plotly's own row-height formula for
  // the ygap below) so the absolute gap above every row stays ~constant.
  const rowHeightFrac = 1 / (gridRows + (gridRows - 1) * 0.34);
  const titleYOffset = 1 + 0.025 / rowHeightFrac;

  const traces = [];
  const annotations = [];
  const layout = {
    dragmode: false,
    bargap: 0.35,
    font: { family: "Inter, sans-serif", color: "#111" },
    title: { text: "", subtitle: { text: "" } },
    showlegend: !onlyOverall,
    legend: { orientation: "h", x: 1, xanchor: "right", y: 1.16, yanchor: "bottom", font: { size: 11, family: LEGEND_FONT } },
    grid: { rows: gridRows, columns: gridCols, pattern: "independent", xgap: 0.12, ygap: 0.34 },
    margin: isNarrow() ? { t: 143, r: 10, b: dense ? 90 : 46, l: 55 } : { t: 155, r: 20, b: dense ? 90 : 50, l: 75 },
    paper_bgcolor: "#fff",
    plot_bgcolor: "#fff",
    width: chartEl.clientWidth || undefined,
    height: gridRows * (isNarrow() ? 260 : 300) + 180
  };

  const subFontSize = (isNarrow() || gridCols > 1) ? 10 : 12;

  panels.forEach((panel, k) => {
    const suffix = k === 0 ? "" : String(k + 1);
    const inLeftColumn = k % gridCols === 0;
    const levels = levelOrder(panel.recs, s.demographic, showOverall);
    // Wrap long category labels onto a second line instead of rotating them
    // — each subplot gets a fraction of the chart width once the grid has
    // more than one column, so labels that fit fine unrotated in a single
    // wide chart need this to avoid colliding with their neighbors here.
    const charBudget = tickCharBudget(chartEl.clientWidth, gridCols, levels.length, subFontSize);
    const xLabels = levels.map(lv => wrapLabel(chipLabel(s.demographic, lv), charBudget));
    traces.push(...buildBarTraces(panel.recs, levels, {
      vLabel: panel.title, axisSuffix: suffix, denseLabels: dense, xLabels, showLegend: k === 0
    }));

    layout["xaxis" + suffix] = {
      type: "category",
      categoryorder: "array",
      categoryarray: xLabels,
      tickfont: { size: subFontSize },
      automargin: true,
      fixedrange: true,
      showgrid: false
    };
    layout["yaxis" + suffix] = {
      // Only the leftmost column repeats the axis title — every panel
      // shares the same scale, so titling every column is redundant and
      // eats into already-tight per-column width.
      title: inLeftColumn ? {
        text: "<b>" + (s.statistics === "percent"
          ? "Percent Experiencing Violence (%)"
          : "Number Experiencing Violence") + "</b>",
        font: { size: 10.5 }
      } : undefined,
      range: yRange,
      gridcolor: "#e8eaee",
      zeroline: false,
      fixedrange: true,
      ...(tickvals ? { tickvals } : { tickformat: "," })
    };
    annotations.push({
      text: `<b>${panel.title}</b>`,
      // Anchored to this panel's own x-axis domain (not the whole figure),
      // so the title sits above its own subplot in every grid column.
      xref: "x" + suffix + " domain", x: 0, xanchor: "left",
      yref: "y" + suffix + " domain", y: titleYOffset, yanchor: "bottom",
      showarrow: false, font: { size: 13 }
    });
  });
  layout.annotations = annotations;

  Plotly.react(chartEl, traces, layout, PLOTLY_CONFIG);
}

let lastView = null;
let lastRenderWidth = 0;
function render() {
  const msg = validationMessage();
  if (msg) { showValidation(msg); lastView = null; renderFootnotes(); return; }
  validationEl.hidden = true;
  chartEl.style.display = "";

  const view = subcatsActive() ? "sub" : "main";
  if (view !== lastView && lastView !== null) Plotly.purge(chartEl);
  lastView = view;

  const idx = filteredIndices();
  if (view === "sub") renderSubcategories(idx);
  else renderMainChart(idx);
  lastRenderWidth = chartEl.clientWidth;
  renderFootnotes();
}

function renderFootnotes() {
  document.getElementById("footnotes").innerHTML =
    footnoteLines().map(l => `<p>${l}</p>`).join("");
}

// ---------------------------------------------------------------------------
// Sidebar construction
// ---------------------------------------------------------------------------
function buildFilterGroup(container, id, label, choices, help) {
  const wrap = document.createElement("div");
  wrap.className = "usvex-filter-group";
  wrap.dataset.filterId = id;

  const head = document.createElement("div");
  head.className = "usvex-filter-head";
  head.innerHTML =
    `<span class="usvex-filter-label">${label}</span>` +
    `<span class="usvex-filter-links">` +
    `<a href="#" data-bulk="all">All</a><a href="#" data-bulk="none">None</a></span>`;
  wrap.appendChild(head);

  for (const value of choices) {
    const lab = document.createElement("label");
    lab.className = "usvex-check";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.value = value;
    cb.checked = state.filters[id].includes(value);
    cb.addEventListener("change", () => {
      const set = new Set(state.filters[id]);
      cb.checked ? set.add(value) : set.delete(value);
      state.filters[id] = choices.filter(c => set.has(c));
      render();
    });
    lab.appendChild(cb);
    lab.appendChild(document.createTextNode(" " + chipLabel(id, value)));
    wrap.appendChild(lab);
  }
  if (help) {
    const h = document.createElement("span");
    h.className = "usvex-filter-help";
    h.textContent = help;
    wrap.appendChild(h);
  }

  head.querySelectorAll("a[data-bulk]").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const all = a.dataset.bulk === "all";
      state.filters[id] = all ? choices.slice() : [];
      wrap.querySelectorAll("input[type=checkbox]").forEach(cb => { cb.checked = all; });
      render();
    });
  });

  container.appendChild(wrap);
}

function buildSidebar() {
  const demoBox = document.getElementById("demographic-filters");
  demoBox.innerHTML = "";
  for (const key of SIDEBAR_DEMO_GROUPS) {
    buildFilterGroup(demoBox, key, DEMOGRAPHICS[key].label, DEMOGRAPHICS[key].order);
  }
  const locBox = document.getElementById("location-filters");
  locBox.innerHTML = "";
  for (const key of SIDEBAR_LOCATION_GROUPS) {
    buildFilterGroup(locBox, key, DEMOGRAPHICS[key].label, DEMOGRAPHICS[key].order);
  }
}

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
function updateConditionalControls() {
  const sliderVisible =
    (state.statistics === "percent" && state.time_period === "past_year") ||
    state.statistics === "count";
  document.getElementById("slider-control").style.display = sliderVisible ? "" : "none";
  document.getElementById("subcat-wrap").style.display =
    state.time_period === "past_year" ? "" : "none";
}

// Sexual violence perpetration has no lifetime measure in the source data —
// disable the Lifetime option and force Past Year while that topic is active.
function updateTimePeriodAvailability() {
  const sel = document.getElementById("time_period");
  const lifetimeOpt = sel.querySelector('option[value="lifetime"]');
  const noLifetime = TOPICS[state.topic].ever === null;
  lifetimeOpt.disabled = noLifetime;
  if (noLifetime && state.time_period === "lifetime") {
    state.time_period = "past_year";
    sel.value = "past_year";
  }
}

function syncTopbarFromState() {
  for (const id of ["time_period", "topic", "demographic", "statistics"]) {
    document.getElementById(id).value = state[id];
  }
  document.getElementById("overall").checked = state.overall;
  document.getElementById("show_subcategories").checked = state.show_subcategories;
  updateTimePeriodAvailability();
  updateConditionalControls();
}

function wireControls() {
  const on = (id, fn) => document.getElementById(id).addEventListener("change", fn);

  on("time_period", e => {
    state.time_period = e.target.value;
    resetSliderDefaults(); updateConditionalControls(); render();
  });
  on("topic", e => {
    state.topic = e.target.value;
    updateTimePeriodAvailability();
    resetSliderDefaults(); updateConditionalControls(); render();
  });
  on("demographic", e => {
    state.demographic = e.target.value;
    resetSliderDefaults(); render();
  });
  on("statistics", e => {
    state.statistics = e.target.value;
    state.count_max = null;
    updateConditionalControls(); render();
  });
  on("overall", e => { state.overall = e.target.checked; render(); });
  on("show_subcategories", e => {
    state.show_subcategories = e.target.checked;
    state.count_max = null;
    render();
  });

  const slider = document.getElementById("scale_max");
  slider.addEventListener("input", () => {
    const v = Number(slider.value);
    if (state.statistics === "count") state.count_max = v;
    else state.scale_max = v;
    document.getElementById("scale_max_value").textContent =
      state.statistics === "count" ? comma(v) : String(v);
    render();
  });

  document.getElementById("home-reset").addEventListener("click", e => {
    e.preventDefault();
    state = defaultState();
    syncTopbarFromState();
    buildSidebar();
    render();
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (validationEl.hidden) render(); }, 120);
  });

  const wireToggle = (btnId, target, collapsedClass, startOpen) => {
    const btn = document.getElementById(btnId);
    const set = open => {
      target.classList.toggle(collapsedClass, !open);
      btn.classList.toggle("closed", !open);
      btn.setAttribute("aria-expanded", String(open));
    };
    set(startOpen);
    btn.addEventListener("click", () => {
      set(target.classList.contains(collapsedClass));
      if (validationEl.hidden) render(); // layout passes explicit width, so this re-measures
    });
  };
  // phones start with both panels collapsed; tablet and desktop start open
  const isPhone = window.innerWidth <= 576;
  wireToggle("topbar-toggle", document.getElementById("topbar"), "collapsed", !isPhone);
  wireToggle("sidebar-toggle", document.getElementById("sidebar-wrap"), "collapsed", !isPhone);

  // Catch every container-width change the window 'resize' event misses
  // (panel toggles, embed/iframe resizes, zoom reflows) and redraw if the
  // chart's width no longer matches what was last rendered.
  if (typeof ResizeObserver !== "undefined") {
    let roTimer = null;
    new ResizeObserver(() => {
      clearTimeout(roTimer);
      roTimer = setTimeout(() => {
        if (validationEl.hidden && Math.abs(chartEl.clientWidth - lastRenderWidth) > 1) render();
      }, 100);
    }).observe(document.querySelector(".usvex-main"));
  }
}

// ---------------------------------------------------------------------------
buildSidebar();
syncTopbarFromState();
resetSliderDefaults();
wireControls();

if (document.fonts && document.fonts.status !== "loaded") {
  let started = false;
  const start = () => { if (!started) { started = true; render(); } };
  document.fonts.ready.then(start);
  setTimeout(start, 1500);
} else {
  render();
}
