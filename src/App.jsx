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
  Legend
} from "recharts";

/* =====================
   CSV処理
===================== */

function parseTimeToHours(hms) {
  const parts = hms.split(":").map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h + m / 60 + s / 3600;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");

  const idxDate = headers.indexOf("date");
  const idxWeight = headers.indexOf("weight_kg");
  const idxSleep = headers.indexOf("sleep_time");

  return lines.slice(1).map((line) => {
    const cols = line.split(",");

    const date = cols[idxDate];
    const weight = Number(cols[idxWeight]);
    const sleep = parseTimeToHours(cols[idxSleep]);

    return {
      date: date,
      weight_kg: weight,
      sleep_hours: sleep
    };
  });
}

/* =====================
   アプリ
===================== */

export default function App() {
  const [data, setData] = useState([]);
  const [source, setSource] = useState("demo");
  const [error, setError] = useState("");

  /* 初期表示：data.csv */
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data.csv`)
      .then((res) => res.text())
      .then((text) => {
        setData(parseCsv(text));
      })
      .catch(() => {
        setError("data.csv を読み込めませんでした");
      });
  }, []);

  /* CSVアップロード */
  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert("CSVは1MB以下にしてください");
      return;
    }

    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const parsed = parseCsv(event.target.result);
        setData(parsed);
        setSource("upload");
      } catch (err) {
        alert("CSV形式が正しくありません");
      }
    };

    reader.readAsText(file);
  };

  if (error) {
    return <div style={{ padding: 20 }}>{error}</div>;
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Health Chart</h1>

      <p>
        CSVフォーマット:
        <br />
        <code>date,weight_kg,sleep_time</code>
      </p>

      <input type="file" accept=".csv" onChange={handleFile} />

      <p>
        データソース：
        {source === "demo" ? "デモ(data.csv)" : "アップロードCSV"}
      </p>

      <div style={{ width: "100%", height: 450 }}>
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />

            <XAxis dataKey="date" />

            <YAxis
              yAxisId="left"
              label={{
                value: "体重 (kg)",
                angle: -90,
                position: "insideLeft"
              }}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              label={{
                value: "睡眠 (h)",
                angle: 90,
                position: "insideRight"
              }}
            />

            <Tooltip />
            <Legend />

            <Bar
              yAxisId="right"
              dataKey="sleep_hours"
              name="睡眠時間"
              fill="#4dabf7"
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="weight_kg"
              name="体重"
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