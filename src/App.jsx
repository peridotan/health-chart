// src/App.jsx
import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceArea,
} from "recharts";

/** ===== settings ===== */
const MOVING_AVG_DAYS = 7;
const PLATEAU_DAYS = 14;
const PLATEAU_RANGE_KG = 0.4;

/** security / validation */
const MAX_FILE_SIZE = 1024 * 1024; // 1MB
const MAX_ROWS = 1000;
const MAX_DATE_LENGTH = 20;

/** ===== utilities ===== */
function parseCSV(text) {
  const lines = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const splitRow = (row) => {
    const out = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < row.length; i++) {
      const ch = row[i];

      if (ch === '"') {
        if (inQ && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === "," && !inQ) {
        out.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }

    out.push(cur.trim());
    return out;
  };

  const sanitizeCell = (value) => String(value ?? "").replace(/^"|"$/g, "").trim();

  const header = splitRow(lines[0]).map(sanitizeCell);
  const idx = {
    date: header.findIndex((h) => h === "date"),
    weight_kg: header.findIndex((h) => h === "weight_kg"),
    sleep_time: header.findIndex((h) => h === "sleep_time"),
  };

  if (idx.date < 0 || idx.weight_kg < 0 || idx.sleep_time < 0) return [];

  const isValidDate = (dateStr) => {
    const s = String(dateStr || "").trim().slice(0, MAX_DATE_LENGTH);

    const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    const m2 = s.match(/^(\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
    const match = m1 || m2;

    if (!match) return false;

    const month = Number(match[2]);
    const day = Number(match[3]);

    if (!Number.isInteger(month) || !Number.isInteger(day)) return false;
    if (month < 1 || month > 12) return false;
    if (day < 1 || day > 31) return false;

    return true;
  };

  const normalizeDate = (dateStr) =>
    String(dateStr || "").trim().slice(0, MAX_DATE_LENGTH);

  const toMinutes = (sleepStr) => {
    const m = String(sleepStr || "")
      .trim()
      .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);

    if (!m) return null;

    const h = Number(m[1]);
    const min = Number(m[2]);
    const sec = m[3] ? Number(m[3]) : 0;

    if (
      !Number.isInteger(h) ||
      !Number.isInteger(min) ||
      !Number.isInteger(sec)
    ) {
      return null;
    }

    if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) {
      return null;
    }

    return h * 60 + min + Math.round(sec / 60);
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]).map(sanitizeCell);

    const date = normalizeDate(cols[idx.date]);
    const weight = Number(cols[idx.weight_kg]);
    const sleepMin = toMinutes(cols[idx.sleep_time]);

    if (!date || !isValidDate(date)) continue;
    if (!Number.isFinite(weight) || weight <= 0 || weight > 500) continue;
    if (sleepMin == null) continue;

    rows.push({
      date,
      weight_kg: weight,
      sleep_hours: sleepMin / 60,
    });

    if (rows.length > MAX_ROWS) {
      throw new Error(`CSVの行数が多すぎます。${MAX_ROWS}行以下にしてください。`);
    }
  }

  return rows;
}

function hoursToHHMM(hours) {
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function niceNumber(n, step) {
  return Math.round(n / step) * step;
}

function formatDateLabel(value) {
  if (!value) return "";

  const s = String(value).trim();

  const m1 = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m1) {
    const mm = String(m1[2]).padStart(2, "0");
    const dd = String(m1[3]).padStart(2, "0");
    return `${mm}/${dd}`;
  }

  const m2 = s.match(/^(\d{2})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m2) {
    const mm = String(m2[2]).padStart(2, "0");
    const dd = String(m2[3]).padStart(2, "0");
    return `${mm}/${dd}`;
  }

  return s;
}

function calcMovingAverage(values, windowSize) {
  return values.map((_, idx) => {
    const start = Math.max(0, idx - windowSize + 1);
    const slice = values.slice(start, idx + 1).filter(Number.isFinite);
    if (!slice.length) return null;
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}

function calcPlateauRanges(data, days, rangeKg) {
  if (!Array.isArray(data) || data.length < days) return [];

  const ranges = [];
  let current = null;

  for (let end = days - 1; end < data.length; end++) {
    const start = end - days + 1;
    const window = data.slice(start, end + 1).map((d) => d.weight_kg);
    const min = Math.min(...window);
    const max = Math.max(...window);
    const isPlateau = max - min <= rangeKg;

    if (isPlateau) {
      if (!current) {
        current = { start, end };
      } else {
        current.end = end;
      }
    } else if (current) {
      ranges.push(current);
      current = null;
    }
  }

  if (current) ranges.push(current);

  return ranges.map((r) => ({
    x1: data[r.start]?.date,
    x2: data[r.end]?.date,
  }));
}

/** ===== UI components ===== */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const weight = payload.find((p) => p.dataKey === "weight_kg")?.value;
  const weightAvg = payload.find((p) => p.dataKey === "weight_avg_7")?.value;
  const sleep = payload.find((p) => p.dataKey === "sleep_hours")?.value;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
        minWidth: 190,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>

      {Number.isFinite(weight) && (
        <div style={{ color: "#ff2d55", marginBottom: 4 }}>
          体重：{Number(weight).toFixed(1)} kg
        </div>
      )}

      {Number.isFinite(weightAvg) && (
        <div style={{ color: "#2e7d32", marginBottom: 4 }}>
          7日平均：{Number(weightAvg).toFixed(1)} kg
        </div>
      )}

      {Number.isFinite(sleep) && (
        <div style={{ color: "#2f7cf6" }}>睡眠：{hoursToHHMM(sleep)}</div>
      )}
    </div>
  );
}

/** ===== main ===== */
export default function App() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setError("");

        const res = await fetch(`${import.meta.env.BASE_URL}data.csv`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`data.csv が読み込めません: ${res.status}`);

        const text = await res.text();
        if (text.length > MAX_FILE_SIZE * 2) {
          throw new Error("data.csv が大きすぎます。");
        }

        const rows = parseCSV(text);
        if (!rows.length) {
          throw new Error("data.csv の形式が不正 or データが空です");
        }

        setData(rows);
      } catch (e) {
        setError(String(e?.message || e));
      }
    })();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const enhancedData = useMemo(() => {
    if (!data.length) return [];

    const weights = data.map((d) => d.weight_kg);
    const avgs = calcMovingAverage(weights, MOVING_AVG_DAYS);

    return data.map((d, i) => ({
      ...d,
      weight_avg_7: avgs[i],
    }));
  }, [data]);

  const plateauRanges = useMemo(
    () => calcPlateauRanges(enhancedData, PLATEAU_DAYS, PLATEAU_RANGE_KG),
    [enhancedData]
  );

  const ranges = useMemo(() => {
    if (!enhancedData.length) {
      return {
        weight: { min: 0, max: 80 },
        sleep: { min: 5, max: 9 },
      };
    }

    const weights = enhancedData
      .flatMap((d) => [Number(d.weight_kg), Number(d.weight_avg_7)])
      .filter(Number.isFinite);

    const sleeps = enhancedData
      .map((d) => Number(d.sleep_hours))
      .filter(Number.isFinite);

    let wMin = Math.min(...weights);
    let wMax = Math.max(...weights);

    const pad = Math.max(0.3, (wMax - wMin) * 0.25);
    wMin = niceNumber(wMin - pad, 0.1);
    wMax = niceNumber(wMax + pad, 0.1);

    if (wMax - wMin < 1.0) {
      const mid = (wMax + wMin) / 2;
      wMin = niceNumber(mid - 0.5, 0.1);
      wMax = niceNumber(mid + 0.5, 0.1);
    }

    let sMin = Math.min(...sleeps);
    let sMax = Math.max(...sleeps);
    sMin = Math.floor(Math.min(5, sMin));
    sMax = Math.ceil(Math.max(9, sMax));

    return {
      weight: { min: wMin, max: wMax },
      sleep: { min: sMin, max: sMax },
    };
  }, [enhancedData]);

  const pageStyle = {
    padding: isMobile ? 12 : 24,
    maxWidth: 980,
    margin: "0 auto",
    paddingBottom: 32,
  };

  const chartOuterStyle = {
    position: "relative",
    width: "100%",
    height: isMobile ? 380 : 520,
    background: "#fff",
    borderRadius: 14,
    overflow: "hidden",
  };

  const leftAxisTitleStyle = {
    position: "absolute",
    left: -6,
    top: "50%",
    transform: "translateY(-50%) rotate(-90deg)",
    transformOrigin: "center",
    color: "#666",
    fontSize: 14,
    pointerEvents: "none",
    whiteSpace: "nowrap",
  };

  const rightAxisTitleStyle = {
    position: "absolute",
    right: -6,
    top: "50%",
    transform: "translateY(-50%) rotate(90deg)",
    transformOrigin: "center",
    color: "#666",
    fontSize: 14,
    pointerEvents: "none",
    whiteSpace: "nowrap",
  };

  return (
    <div style={pageStyle}>
      <div style={{ marginTop: isMobile ? 8 : 18 }}>
        <div style={chartOuterStyle}>
          {!isMobile && <div style={leftAxisTitleStyle}>体重 (kg) ※折れ線</div>}
          {!isMobile && <div style={rightAxisTitleStyle}>睡眠 (h) ※棒</div>}

          <ResponsiveContainer>
            <ComposedChart
              data={enhancedData}
              margin={
                isMobile
                  ? { top: 12, right: 12, left: 12, bottom: 12 }
                  : { top: 20, right: 78, left: 78, bottom: 20 }
              }
            >
              <CartesianGrid strokeDasharray="3 3" />

              {plateauRanges.map((r, i) => (
                <ReferenceArea
                  key={`plateau-${i}`}
                  x1={r.x1}
                  x2={r.x2}
                  yAxisId="left"
                  ifOverflow="extendDomain"
                  fill="#ffe8a3"
                  fillOpacity={0.25}
                  strokeOpacity={0}
                />
              ))}

              <XAxis
                dataKey="date"
                tickMargin={isMobile ? 6 : 10}
                interval="preserveStartEnd"
                minTickGap={isMobile ? 18 : 36}
                tickFormatter={formatDateLabel}
                style={{ fontSize: isMobile ? 10 : 12 }}
              />

              <YAxis
                yAxisId="left"
                width={isMobile ? 34 : 46}
                domain={[ranges.weight.min, ranges.weight.max]}
                tickCount={isMobile ? 4 : 6}
                tickMargin={isMobile ? 4 : 8}
                tickFormatter={(v) => Number(v).toFixed(1)}
                style={{ fontSize: isMobile ? 10 : 12 }}
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                width={isMobile ? 34 : 46}
                domain={[ranges.sleep.min, ranges.sleep.max]}
                tickCount={isMobile ? 4 : 5}
                tickMargin={isMobile ? 4 : 8}
                tickFormatter={(v) => hoursToHHMM(v)}
                style={{ fontSize: isMobile ? 10 : 12 }}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                verticalAlign="bottom"
                height={isMobile ? 60 : 44}
                wrapperStyle={{ fontSize: isMobile ? 11 : 12 }}
              />

              <Bar
                yAxisId="right"
                dataKey="sleep_hours"
                name="睡眠(時間)"
                fill="#4dabf7"
                radius={[6, 6, 0, 0]}
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="weight_avg_7"
                name="7日平均(kg)"
                stroke="#2e7d32"
                strokeWidth={isMobile ? 2.5 : 3}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
                legendType="plainline"
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="weight_kg"
                name="体重(kg)"
                stroke="#ff2d55"
                strokeWidth={2}
                dot={
                  isMobile
                    ? { r: 3, stroke: "#ff2d55", fill: "#fff" }
                    : { r: 4, stroke: "#ff2d55", fill: "#fff" }
                }
                activeDot={isMobile ? { r: 4 } : { r: 6 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {error && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #ffb4b4",
              background: "#fff2f2",
              borderRadius: 10,
              color: "#b00020",
              whiteSpace: "pre-wrap",
              fontSize: isMobile ? 12 : 14,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
