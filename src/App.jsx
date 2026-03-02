import { useEffect, useState } from "react";
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

/* =========================
   CSV パース処理
========================= */

function parseTimeToHours(hms) {
  // "7:13:00" → 7.216...
  const [h, m, s] = hms.split(":").map(Number);
  return (h || 0) + (m || 0) / 60 + (s || 0) / 3600;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());

  const idxDate = headers.indexOf("date");
  const idxWeight = headers.indexOf("weight_kg");
  const idxSleep = headers.indexOf("sleep_time");

  return lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());

    const date = cols[idxDate];
    const weight_kg = Number(cols[idxWeight]);
    const sleep_time = cols[idxSleep];
    const sleep_hours = parseTimeToHours(sleep_time);

    return {
      date,
      weight_kg,
      sleep_hours,
    };
  });
}

/* =========================
   メインコンポーネント
========================= */

export default function App() {
  const [data, setData] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    // GitHub Pages 対応（base考慮）
    fetch(`${import.meta.env.BASE_URL}data.csv?ts=${Date.now()}`)
      .then((res) => {
        if (!res.ok) throw new Error("CSVの取得に失敗しました");
        return res.text();
      })
      .then((text) => {
        const parsed = parseCsv(text);
        setData(parsed);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, []);

  if (error) {
    return (
      <div style={{ padding: 20, color: "red" }}>
        エラー: {error}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div style={{ padding: 20 }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>健康管理</h1>
      <p>体重（折れ線） + 睡眠（棒）</p>

      <div style={{ width: "100%", height: 450 }}>
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="date" />

            {/* 体重（左軸） */}
            <YAxis
              yAxisId="left"
              domain={["dataMin - 0.5", "dataMax + 0.5"]}
              label={{
                value: "体重 (kg)",
                angle: -90,
                position: "insideLeft",
              }}
            />

            {/* 睡眠（右軸） */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[5, 9]}
              label={{
                value: "睡眠 (h)",
                angle: 90,
                position: "insideRight",
              }}
            />

            <Tooltip />
            <Legend />

            <Bar
              yAxisId="right"
              dataKey="sleep_hours"
              name="睡眠(時間)"
              fill="#4dabf7"
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="weight_kg"
              name="体重(kg)"
              stroke="#ff2d55"
              strokeWidth={2}
              dot
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
