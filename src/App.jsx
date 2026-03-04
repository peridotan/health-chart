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
} from "recharts";

/** ===== utilities ===== */
function parseCSV(text) {
  // very small CSV parser (handles quoted fields minimally)
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

  const header = splitRow(lines[0]).map((h) => h.replace(/^"|"$/g, ""));
  const idx = {
    date: header.findIndex((h) => h === "date"),
    weight_kg: header.findIndex((h) => h === "weight_kg"),
    sleep_time: header.findIndex((h) => h === "sleep_time"),
  };

  // Accept "date,weight_kg,sleep_time" only
  if (idx.date < 0 || idx.weight_kg < 0 || idx.sleep_time < 0) return [];

  const toMinutes = (sleepStr) => {
    // accepts "HH:MM" or "HH:MM:SS"
    const parts = String(sleepStr).split(":").map((n) => parseInt(n, 10));
    if (parts.length < 2 || parts.some((n) => Number.isNaN(n))) return null;
    const [h, m, s = 0] = parts;
    return h * 60 + m + Math.round(s / 60);
  };

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitRow(lines[i]).map((c) => c.replace(/^"|"$/g, ""));
    const date = cols[idx.date];
    const w = Number(cols[idx.weight_kg]);
    const sleepMin = toMinutes(cols[idx.sleep_time]);

    if (!date || !Number.isFinite(w) || sleepMin == null) continue;

    rows.push({
      date,
      weight_kg: w,
      sleep_hours: sleepMin / 60, // numeric for chart
      sleep_minutes: sleepMin, // for formatting
    });
  }

  // sort by date string (works best if you use YYYY-MM-DD; still OK for MM/DD in your current data)
//  rows.sort((a, b) => (a.date > b.date ? 1 : a.date < b.date ? -1 : 0));
  return rows;
}

function hoursToHHMM(hours) {
  const totalMinutes = Math.round(Number(hours) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function minutesToHHMM(min) {
  const totalMinutes = Math.round(Number(min));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function niceNumber(n, step) {
  return Math.round(n / step) * step;
}

/** ===== UI components ===== */
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  const weight = payload.find((p) => p.dataKey === "weight_kg")?.value;
  const sleep = payload.find((p) => p.dataKey === "sleep_hours")?.value;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: "10px 12px",
        boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
        minWidth: 180,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{label}</div>
      {Number.isFinite(weight) && (
        <div style={{ color: "#ff2d55", marginBottom: 4 }}>
          体重：{weight.toFixed(1)} kg
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
  const [sourceLabel, setSourceLabel] = useState("デモ(data.csv)");
  const [error, setError] = useState("");

  // load demo csv from /public/data.csv
  useEffect(() => {
    (async () => {
      try {
        setError("");
        const res = await fetch(`${import.meta.env.BASE_URL}data.csv`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`data.csv が読み込めません: ${res.status}`);
        const text = await res.text();
        const rows = parseCSV(text);
        if (!rows.length) throw new Error("data.csv の形式が不正 or データが空です");
        setData(rows);
        setSourceLabel("デモ(data.csv)");
      } catch (e) {
        setError(String(e?.message || e));
      }
    })();
  }, []);

  const ranges = useMemo(() => {
    if (!data.length) {
      return {
        weight: { min: 0, max: 80 },
        sleep: { min: 5, max: 9 },
      };
    }

    const weights = data.map((d) => d.weight_kg);
    const sleeps = data.map((d) => d.sleep_hours);

    let wMin = Math.min(...weights);
    let wMax = Math.max(...weights);

    // pad a bit and snap to 0.1kg
    const pad = Math.max(0.3, (wMax - wMin) * 0.25);
    wMin = niceNumber(wMin - pad, 0.1);
    wMax = niceNumber(wMax + pad, 0.1);

    // keep minimum visible range (avoid flat charts)
    if (wMax - wMin < 1.0) {
      const mid = (wMax + wMin) / 2;
      wMin = niceNumber(mid - 0.5, 0.1);
      wMax = niceNumber(mid + 0.5, 0.1);
    }

    // sleep range: keep reasonable band, but include data
    let sMin = Math.min(...sleeps);
    let sMax = Math.max(...sleeps);
    sMin = Math.floor(Math.min(5, sMin)); // don't go too low visually
    sMax = Math.ceil(Math.max(9, sMax)); // don't go too high visually

    return {
      weight: { min: wMin, max: wMax },
      sleep: { min: sMin, max: sMax },
    };
  }, [data]);

  const onUpload = async (file) => {
    try {
      setError("");
      if (!file) return;

      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) throw new Error("CSVの形式が不正です（date,weight_kg,sleep_time）");

      setData(rows);
      setSourceLabel(`アップロード(${file.name})`);
    } catch (e) {
      setError(String(e?.message || e));
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ margin: 0, fontSize: 44, letterSpacing: 0.2 }}>Health Chart</h1>

      <div style={{ marginTop: 12, lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700 }}>CSVフォーマット:</div>
        <div style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          date,weight_kg,sleep_time
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-flex",
            gap: 10,
            alignItems: "center",
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 10,
            background: "#fff",
            cursor: "pointer",
          }}
        >
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => onUpload(e.target.files?.[0])}
          />
          <span style={{ fontWeight: 700 }}>CSVをアップロード</span>
          <span style={{ color: "#666" }}>（選ぶだけで反映）</span>
        </label>

        <div style={{ color: "#333" }}>
          データソース：<b>{sourceLabel}</b>
        </div>
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
          }}
        >
          {error}
        </div>
      )}

      <div style={{ marginTop: 18 }}>
        <h2 style={{ margin: "18px 0 8px", fontSize: 28 }}>健康管理</h2>
        <div style={{ color: "#666", marginBottom: 10 }}>体重（折れ線）＋睡眠（棒）</div>

        <div style={{ width: "100%", height: 520, background: "#fff", borderRadius: 14 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 10, right: 36, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />

              <XAxis
                dataKey="date"
                tickMargin={10}
                interval="preserveStartEnd"
                minTickGap={40}
/>

              {/* Left axis: weight (narrow range) */}
              <YAxis
                yAxisId="left"
                domain={[ranges.weight.min, ranges.weight.max]}
                tickCount={6}
                tickMargin={8}
                label={{ value: "体重 (kg)", angle: -90, position: "insideLeft" }}
              />

              {/* Right axis: sleep */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[ranges.sleep.min, ranges.sleep.max]}
                tickMargin={8}
                tickFormatter={(v) => hoursToHHMM(v)}
                label={{ value: "睡眠 (h)", angle: 90, position: "insideRight" }}
              />

              <Tooltip content={<CustomTooltip />} />
              <Legend verticalAlign="bottom" height={36} />

              {/* Bars: sleep */}
              <Bar
                yAxisId="right"
                dataKey="sleep_hours"
                name="睡眠(時間)"
                fill="#4dabf7"
                radius={[6, 6, 0, 0]}
              />

              {/* Line: weight */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="weight_kg"
                name="体重(kg)"
                stroke="#ff2d55"
                strokeWidth={2}
                dot={{ r: 4, stroke: "#ff2d55", fill: "#fff" }}
                activeDot={{ r: 6 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div style={{ marginTop: 10, color: "#666", fontSize: 13 }}>
          ※ 睡眠は内部的に「時間(小数)」で描画し、表示だけ「HH:MM」に変換しています。
        </div>
      </div>
    </div>
  );
}