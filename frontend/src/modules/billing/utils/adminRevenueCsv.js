// Build chuỗi CSV từ report đã tải của GET /api/admin/payments/revenue.
// Không gọi API mới. Dùng BOM UTF-8 để Excel mở đúng tiếng Việt.

function escapeCsv(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function rowsToCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");
}

export function buildRevenueCsv(report, { granularityLabel = "", fromLabel = "", toLabel = "" } = {}) {
  if (!report) return "";
  const totalRevenue = report.totalRevenue ?? 0;
  const lines = [];

  lines.push(["BÁO CÁO DOANH THU"]);
  if (fromLabel || toLabel) lines.push(["Kỳ", `${fromLabel} - ${toLabel}`]);
  if (granularityLabel) lines.push(["Độ chi tiết", granularityLabel]);
  lines.push([]);
  lines.push(["Chỉ tiêu", "Giá trị"]);
  lines.push(["Tổng doanh thu (VND)", totalRevenue]);
  lines.push(["Số đơn PAID có ngày thanh toán trong kỳ", report.paidOrderCount ?? 0]);
  lines.push(["Tổng số đơn tạo trong kỳ (mọi trạng thái)", report.totalOrderCount ?? 0]);
  // successRate trong report là tỉ lệ 0–1 (trang dùng percent.format), nên nhân 100
  // để ghi đúng số phần trăm dưới nhãn "(%)".
  lines.push(["Tỉ lệ chuyển đổi (%)", ((report.successRate ?? 0) * 100).toFixed(1)]);
  lines.push(["Giá trị đơn trung bình (VND)", report.averageOrderValue ?? 0]);
  lines.push([
    "Ghi chú",
    "Đơn PAID thiếu ngày thanh toán (paidAt trống, thường là đơn qua Đối soát) không được tính vào doanh thu.",
  ]);
  lines.push([]);
  lines.push(["Doanh thu theo kỳ"]);
  lines.push(["Kỳ", "Doanh thu (VND)", "Số đơn"]);
  for (const point of report.series ?? []) {
    lines.push([point.period, point.revenue, point.orders]);
  }
  lines.push([]);
  lines.push(["Doanh thu theo gói"]);
  lines.push(["Gói", "Số đơn", "Doanh thu (VND)", "Tỉ trọng (%)"]);
  for (const plan of report.byPlan ?? []) {
    const share = totalRevenue > 0 ? ((plan.revenue / totalRevenue) * 100).toFixed(1) : "0.0";
    lines.push([plan.planCode, plan.orders, plan.revenue, share]);
  }
  return "\uFEFF" + rowsToCsv(lines) + "\r\n";
}

export function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
