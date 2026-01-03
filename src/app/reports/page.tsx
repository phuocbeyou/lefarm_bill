"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getReportSummary, getDailyReport, getAllBills, ReportSummary, DailyData, Bill } from "@/lib/db";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export default function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [recentBills, setRecentBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartDays, setChartDays] = useState(30);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [summaryData, daily, bills] = await Promise.all([
          getReportSummary(),
          getDailyReport(chartDays),
          getAllBills(),
        ]);
        setSummary(summaryData);
        setDailyData(daily);
        setRecentBills(bills.slice(0, 10)); // Last 10 bills
      } catch (error) {
        console.error("Error loading report data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [chartDays]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}tr`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(0)}k`;
    }
    return value.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getDate()}/${date.getMonth() + 1}`;
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[200px]">
        <p className="text-gray-400">Đang tải...</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Header */}
      <h1 className="text-xl font-bold text-amber-500">Báo cáo doanh thu</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-amber-900/50 to-amber-800/30 border-amber-700/50">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-amber-300/70 uppercase tracking-wider">Hôm nay</p>
            <p className="text-lg font-bold text-amber-400 mt-1">
              {formatCurrency(summary?.today.total || 0)}
            </p>
            <p className="text-[10px] text-gray-400">{summary?.today.count || 0} đơn</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border-blue-700/50">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-blue-300/70 uppercase tracking-wider">Tuần này</p>
            <p className="text-lg font-bold text-blue-400 mt-1">
              {formatCurrency(summary?.week.total || 0)}
            </p>
            <p className="text-[10px] text-gray-400">{summary?.week.count || 0} đơn</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-900/50 to-green-800/30 border-green-700/50">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-green-300/70 uppercase tracking-wider">Tháng này</p>
            <p className="text-lg font-bold text-green-400 mt-1">
              {formatCurrency(summary?.month.total || 0)}
            </p>
            <p className="text-[10px] text-gray-400">{summary?.month.count || 0} đơn</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">📈 Doanh thu theo ngày</h2>
            <select
              value={chartDays}
              onChange={(e) => setChartDays(Number(e.target.value))}
              className="bg-gray-800 border border-gray-700 rounded text-xs px-2 py-1"
            >
              <option value={7}>7 ngày</option>
              <option value={14}>14 ngày</option>
              <option value={30}>30 ngày</option>
            </select>
          </div>

          {dailyData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    stroke="#6b7280"
                    fontSize={10}
                  />
                  <YAxis
                    tickFormatter={formatCurrency}
                    stroke="#6b7280"
                    fontSize={10}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1f2937",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value) => [`${(value as number || 0).toLocaleString()}đ`, "Doanh thu"]}
                    labelFormatter={(label) => `Ngày ${formatDate(label as string)}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="total"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTotal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
              Chưa có dữ liệu
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Bills */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4">
          <h2 className="font-semibold text-white mb-3">🧾 Đơn hàng gần đây</h2>

          {recentBills.length > 0 ? (
            <div className="space-y-2">
              {recentBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {bill.customerName || "Khách lẻ"}
                    </p>
                    <p className="text-[10px] text-gray-400">
                      {new Date(bill.createdAt).toLocaleDateString("vi-VN", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {bill.orderCode && ` • ${bill.orderCode}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-500">
                      {bill.total.toLocaleString()}đ
                    </p>
                    <p className="text-[10px] text-gray-400">{bill.items.length} sản phẩm</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-6 text-sm">
              Chưa có đơn hàng nào. Tạo bill và xuất để lưu lịch sử.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Total Stats */}
      <div className="text-center text-xs text-gray-500">
        Tổng cộng: {summary?.allTime.count || 0} đơn hàng
      </div>
    </div>
  );
}
