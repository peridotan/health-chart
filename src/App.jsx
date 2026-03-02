import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

const data = [
  { date: "02/18", weight: 63.5, sleep: 6.8 },
  { date: "02/19", weight: 63.6, sleep: 6.33 },
  { date: "02/20", weight: 63.4, sleep: 7.9 },
  { date: "02/21", weight: 63.4, sleep: 6.18 },
  { date: "02/22", weight: 63.5, sleep: 6.05 },
  { date: "02/23", weight: 63.3, sleep: 6.27 },
  { date: "02/24", weight: 63.3, sleep: 6.62 },
  { date: "02/25", weight: 62.8, sleep: 7.67 },
  { date: "02/26", weight: 62.7, sleep: 7.78 },
  { date: "02/27", weight: 62.8, sleep: 7.82 },
  { date: "02/28", weight: 63.0, sleep: 6.15 },
  { date: "03/01", weight: 62.9, sleep: 8.63 },
  { date: "03/02", weight: 62.6, sleep: 7.22 },
];

export default function App() {
  return (
    <div style={{ width: "100%" }}>
      <div style={{ padding: 40, maxWidth: 980, margin: "0 auto" }}>
        <h2>健康管理</h2>
        <p>体重（折れ線）＋睡眠（棒）</p>

        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <Tooltip />
              <Legend />

              {/* 左軸：体重 */}
              <YAxis
                yAxisId="left"
                domain={[62, 64]}
                tick={{ fontSize: 12 }}
                label={{
                  value: "体重 (kg)",
                  angle: -90,
                  position: "insideLeft",
                }}
              />

              {/* 右軸：睡眠 */}
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={[5, 9]}
                tick={{ fontSize: 12 }}
                label={{
                  value: "睡眠 (h)",
                  angle: 90,
                  position: "insideRight",
                }}
              />

              {/* 棒：睡眠（右軸） */}
              <Bar
                yAxisId="right"
                dataKey="sleep"
                name="睡眠(時間)"
                fill="#4dabf7"
                opacity={0.85}
              />

              {/* 線：体重（左軸） */}
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="weight"
                name="体重(kg)"
                stroke="#ff4d6d"
                strokeWidth={2}
                dot
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}