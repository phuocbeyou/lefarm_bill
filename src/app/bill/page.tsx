"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { 
  getAllProducts, 
  getSettings, 
  getAllCustomers,
  migrateFromLocalStorage, 
  initDefaultSettings,
  Product,
  Settings,
  Customer
} from "@/lib/db";

interface BillItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unit: string;
  price: number;
  availablePrices: number[];
}

const defaultSettings: Settings = {
  id: "main",
  shopName: "Hạt điều Tinh Hoa Việt",
  shopAddress: "TT Tân Khai, H. Hớn Quản, T. Bình Phước",
  shopPhone: "0349 939 393 - 0988 885 192",
  shopLogo: "",
  bankName: "MB Bank",
  bankBin: "970422",
  accountNumber: "0988885192",
  accountName: "PHAM THI HONG NHUNG",
};

export default function BillPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [billItems, setBillItems] = useState<BillItem[]>([
    { id: "1", productId: "", productName: "", quantity: 0, unit: "KG", price: 0, availablePrices: [] },
  ]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [discount, setDiscount] = useState(0);
  const [today, setToday] = useState("");
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Autocomplete state
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const customerInputRef = useRef<HTMLDivElement>(null);

  const billRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("vi-VN"));

    const loadData = async () => {
      try {
        await migrateFromLocalStorage();
        await initDefaultSettings();
        
        const [productsData, settingsData, customersData] = await Promise.all([
          getAllProducts(),
          getSettings(),
          getAllCustomers(),
        ]);
        
        setProducts(productsData);
        setCustomers(customersData);
        if (settingsData) {
          setSettings(settingsData);
        }
      } catch (error) {
        console.error("Error loading bill data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (customerInputRef.current && !customerInputRef.current.contains(event.target as Node)) {
        setShowCustomerSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCustomerNameChange = (value: string) => {
    setCustomerName(value);
    if (value.trim().length > 0) {
      const filtered = customers.filter((c) => 
        c.name.toLowerCase().includes(value.toLowerCase()) ||
        c.phone.includes(value)
      );
      setFilteredCustomers(filtered);
      setShowCustomerSuggestions(filtered.length > 0);
    } else {
      setShowCustomerSuggestions(false);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setCustomerName(customer.name);
    setCustomerPhone(customer.phone);
    setCustomerAddress(customer.address);
    setShowCustomerSuggestions(false);
  };

  const handleProductSelect = (itemId: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (product) {
      setBillItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                productId: product.id,
                productName: product.name,
                price: product.price,
                unit: product.unit || "KG",
                availablePrices: product.priceHistory || [product.price],
              }
            : item
        )
      );
    }
  };

  const handlePriceChange = (itemId: string, price: number) => {
    setBillItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, price } : item
      )
    );
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setBillItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity } : item
      )
    );
  };

  const addRow = () => {
    const newId = Date.now().toString();
    setBillItems([
      ...billItems,
      { id: newId, productId: "", productName: "", quantity: 0, unit: "KG", price: 0, availablePrices: [] },
    ]);
  };

  const deleteRow = (itemId: string) => {
    if (billItems.length <= 1) return;
    setBillItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const subtotal = billItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const total = subtotal - discount;
  const validItems = billItems.filter((item) => item.productId && item.quantity > 0);

  const generateVietQRUrl = () => {
    const bankBin = settings.bankBin || "970422";
    if (!settings.accountNumber) return "";
    
    const description = customerName || "";
    const amount = total > 0 ? `amount=${total}` : "";
    const params = [amount, `addInfo=${encodeURIComponent(description)}`, `accountName=${encodeURIComponent(settings.accountName)}`].filter(Boolean).join("&");
    return `https://img.vietqr.io/image/${bankBin}-${settings.accountNumber}-cdHGLoP.png?${params}`;
  };

  const qrCodeUrl = generateVietQRUrl();

  const clearBill = () => {
    setBillItems([
      { id: "1", productId: "", productName: "", quantity: 0, unit: "KG", price: 0, availablePrices: [] },
    ]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setOrderCode("");
    setDiscount(0);
  };

  const exportAsImage = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    setShowExportMenu(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach((style) => {
            if (style.parentNode !== clonedDoc.querySelector('[data-export-template]')?.parentNode) {
              style.remove();
            }
          });
        },
      });
      
      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `hoadon_${orderCode || Date.now()}.png`;
      link.href = imgData;
      link.click();
    } catch (error) {
      console.error("Export image error:", error);
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    setShowExportMenu(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      const canvas = await html2canvas(exportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const styles = clonedDoc.querySelectorAll('style, link[rel="stylesheet"]');
          styles.forEach((style) => {
            if (style.parentNode !== clonedDoc.querySelector('[data-export-template]')?.parentNode) {
              style.remove();
            }
          });
        },
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 10, 10, imgWidth, imgHeight);
      pdf.save(`hoadon_${orderCode || Date.now()}.pdf`);
    } catch (error) {
      console.error("Export PDF error:", error);
    } finally {
      setExporting(false);
    }
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
      {/* Bill Card - Input Form */}
      <Card className="bg-white text-gray-800 border-0 shadow-xl rounded-2xl overflow-hidden" ref={billRef}>
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-800 to-amber-900 text-white p-4">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0 overflow-hidden">
              <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-full object-cover" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{settings.shopName}</h1>
              <p className="text-xs text-white/80">{settings.shopAddress}</p>
              <p className="text-xs text-white/80">📞 {settings.shopPhone}</p>
            </div>
          </div>
        </div>

        <CardContent className="p-4 space-y-4">
          {/* Title & Date */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h2 className="text-lg font-bold text-amber-800">Phiếu bán hàng</h2>
            <span className="text-sm font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">{today}</span>
          </div>

          {/* Customer Info */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="relative" ref={customerInputRef}>
                <Input
                  value={customerName}
                  onChange={(e) => handleCustomerNameChange(e.target.value)}
                  onFocus={() => customerName.trim() && setShowCustomerSuggestions(true)}
                  placeholder="Tên khách hàng"
                  className="h-9 text-sm bg-gray-50 border-gray-200"
                />
                {/* Autocomplete Suggestions */}
                {showCustomerSuggestions && (
                  <div className="absolute top-10 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCustomer(c)}
                        className="w-full px-3 py-2 text-left hover:bg-amber-50 border-b border-gray-50 last:border-0"
                      >
                        <p className="text-sm font-medium text-gray-800">{c.name}</p>
                        <p className="text-[10px] text-gray-500">{c.phone}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Số điện thoại"
                className="h-9 text-sm bg-gray-50 border-gray-200"
              />
            </div>
            <Input
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              placeholder="Địa chỉ"
              className="h-9 text-sm bg-gray-50 border-gray-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              placeholder="Mã đơn hàng"
              className="h-9 text-sm bg-gray-50 border-gray-200"
            />
            <Input
              type="number"
              value={discount || ""}
              onChange={(e) => setDiscount(Number(e.target.value))}
              placeholder="Giảm giá (đ)"
              className="h-9 text-sm bg-gray-50 border-gray-200"
            />
          </div>

          {/* Product List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-600">Sản phẩm</h3>
              <button onClick={addRow} className="text-xs text-amber-700 font-medium hover:underline">
                + Thêm dòng
              </button>
            </div>

            {billItems.map((item, index) => (
              <div key={item.id} className="bg-gray-50 rounded-xl p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4">{index + 1}</span>
                  <select
                    value={item.productId}
                    onChange={(e) => handleProductSelect(item.id, e.target.value)}
                    className="flex-1 p-2 text-sm border border-gray-200 rounded-lg bg-white"
                  >
                    <option value="">-- Chọn sản phẩm --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  {billItems.length > 1 && (
                    <button onClick={() => deleteRow(item.id)} className="text-red-400 hover:text-red-500 p-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="15" y1="9" x2="9" y2="15"/>
                        <line x1="9" y1="9" x2="15" y2="15"/>
                      </svg>
                    </button>
                  )}
                </div>

                {item.productId && (
                  <div className="space-y-2 pl-6">
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        value={item.quantity || ""}
                        onChange={(e) => handleQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                        className="w-20 h-8 text-sm text-center bg-white border-gray-200"
                        placeholder="SL"
                      />
                      <span className="text-xs text-gray-500">{item.unit}</span>
                      
                      <div className="flex-1 flex items-center gap-1">
                        <span className="text-xs text-gray-400">×</span>
                        {item.availablePrices.length > 1 ? (
                          <div className="flex gap-1 items-center">
                            <select
                              value={item.availablePrices.includes(item.price) ? item.price : "custom"}
                              onChange={(e) => {
                                if (e.target.value === "custom") {
                                  handlePriceChange(item.id, 0);
                                } else {
                                  handlePriceChange(item.id, Number(e.target.value));
                                }
                              }}
                              className="h-8 text-sm border border-gray-200 rounded-md bg-white px-1"
                            >
                              {item.availablePrices.map((p) => (
                                <option key={p} value={p}>
                                  {(p / 1000).toFixed(0)}k
                                </option>
                              ))}
                              <option value="custom">Khác...</option>
                            </select>
                            {!item.availablePrices.includes(item.price) && (
                              <Input
                                type="number"
                                value={item.price || ""}
                                onChange={(e) => handlePriceChange(item.id, Number(e.target.value))}
                                className="w-20 h-8 text-sm bg-white border-gray-200"
                                placeholder="Giá"
                                autoFocus
                              />
                            )}
                          </div>
                        ) : (
                          <Input
                            type="number"
                            value={item.price || ""}
                            onChange={(e) => handlePriceChange(item.id, Number(e.target.value))}
                            className="w-24 h-8 text-sm bg-white border-gray-200"
                            placeholder="Giá"
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <span className="text-sm font-semibold text-amber-800">
                        {item.quantity > 0 ? (item.price * item.quantity).toLocaleString() + "đ" : "-"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 space-y-3">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tạm tính:</span>
              <span>{subtotal.toLocaleString()}đ</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Giảm giá:</span>
                <span>-{discount.toLocaleString()}đ</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
              <span className="font-bold text-gray-800">TỔNG CỘNG:</span>
              <span className="text-xl font-black text-amber-800">{total.toLocaleString()}đ</span>
            </div>
          </div>

          {/* QR Payment */}
          {settings.accountNumber && (
            <div className="flex flex-col items-center gap-3 py-4 border-t border-gray-100">
              <div className="bg-amber-50 text-amber-800 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                Quét mã để thanh toán
              </div>
              <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-100">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="VietQR" className="w-52 h-52 object-contain" />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-gray-800">{settings.accountNumber}</p>
                <p className="text-[10px] text-gray-500 uppercase">{settings.bankName} - {settings.accountName}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button 
          variant="outline" 
          onClick={clearBill}
          className="flex-1 h-12 border-gray-700 text-gray-300 rounded-xl"
        >
          🗑️ Xóa
        </Button>
        <div className="relative flex-1">
          <Button 
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting || validItems.length === 0}
            className="w-full h-12 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 rounded-xl text-white font-semibold shadow-lg shadow-amber-600/30"
          >
            {exporting ? "⏳ Đang xuất..." : "📤 Lưu & Chia sẻ"}
          </Button>
          
          {showExportMenu && (
            <div className="absolute bottom-14 left-0 right-0 bg-gray-800 rounded-xl shadow-xl overflow-hidden z-10">
              <button
                onClick={exportAsImage}
                className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 flex items-center gap-2"
              >
                🖼️ Xuất ảnh (PNG)
              </button>
              <button
                onClick={exportAsPDF}
                className="w-full px-4 py-3 text-left text-white hover:bg-gray-700 flex items-center gap-2 border-t border-gray-700"
              >
                📄 Xuất PDF
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Export Template */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div 
          ref={exportRef} 
          style={{ 
            width: "600px", 
            backgroundColor: "#ffffff", 
            fontFamily: "'Segoe UI', Arial, sans-serif",
            color: "#333333"
          }}
        >
          {/* Header */}
          <div style={{ padding: "30px 30px 20px 30px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <img src="/logo.jpg" alt="Logo" style={{ width: "50px", height: "50px", borderRadius: "50%", objectFit: "cover" }} />
                <div>
                  <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#8B4513", margin: 0 }}>{settings.shopName}</h1>
                  <p style={{ fontSize: "11px", color: "#666666", margin: "3px 0 0 0" }}>{settings.shopAddress}</p>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: "11px", color: "#666666", margin: "0" }}>Ngày: <strong>{today}</strong></p>
                <p style={{ fontSize: "11px", color: "#666666", margin: "3px 0 0 0" }}>Mã: <strong>{orderCode || "---"}</strong></p>
              </div>
            </div>

            {/* Title */}
            <h2 style={{ 
              fontSize: "28px", 
              fontWeight: 700, 
              color: "#dc2626", 
              textAlign: "center", 
              margin: "25px 0 20px 0",
              letterSpacing: "2px"
            }}>
              HÓA ĐƠN BÁN HÀNG
            </h2>

            {/* Customer & Bank Info */}
            <div style={{ display: "flex", gap: "40px", marginBottom: "20px" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: "12px", color: "#666666", margin: "0 0 3px 0" }}>
                  <strong style={{ color: "#333" }}>Khách hàng:</strong> {customerName || "---"}
                </p>
                <p style={{ fontSize: "12px", color: "#666666", margin: "0 0 3px 0" }}>
                  <strong style={{ color: "#333" }}>SĐT:</strong> {customerPhone || "---"}
                </p>
                <p style={{ fontSize: "12px", color: "#666666", margin: "0" }}>
                  <strong style={{ color: "#333" }}>Địa chỉ:</strong> {customerAddress || "---"}
                </p>
              </div>
              <div style={{ flex: 1, textAlign: "right" }}>
                <p style={{ fontSize: "12px", color: "#666666", margin: "0 0 3px 0" }}>
                  <strong style={{ color: "#333" }}>Hotline:</strong> {settings.shopPhone}
                </p>
              </div>
            </div>
          </div>

          {/* Product Table */}
          <div style={{ padding: "0 30px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#8B4513" }}>
                  <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: "#ffffff", width: "40px" }}>STT</th>
                  <th style={{ padding: "12px 8px", textAlign: "left", fontSize: "12px", fontWeight: 600, color: "#ffffff" }}>SẢN PHẨM</th>
                  <th style={{ padding: "12px 8px", textAlign: "center", fontSize: "12px", fontWeight: 600, color: "#ffffff", width: "60px" }}>SL</th>
                  <th style={{ padding: "12px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "#ffffff", width: "90px" }}>ĐƠN GIÁ</th>
                  <th style={{ padding: "12px 8px", textAlign: "right", fontSize: "12px", fontWeight: 600, color: "#ffffff", width: "100px" }}>THÀNH TIỀN</th>
                </tr>
              </thead>
              <tbody>
                {validItems.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "12px 8px", fontSize: "13px", color: "#666666", textAlign: "center" }}>{idx + 1}</td>
                    <td style={{ padding: "12px 8px", fontSize: "13px", color: "#333333", fontWeight: 500 }}>{item.productName}</td>
                    <td style={{ padding: "12px 8px", fontSize: "13px", color: "#666666", textAlign: "center" }}>{item.quantity} {item.unit}</td>
                    <td style={{ padding: "12px 8px", fontSize: "13px", color: "#666666", textAlign: "right" }}>{item.price.toLocaleString()}</td>
                    <td style={{ padding: "12px 8px", fontSize: "13px", color: "#dc2626", textAlign: "right", fontWeight: 600 }}>{(item.price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div style={{ marginTop: "15px", borderTop: "2px solid #8B4513", paddingTop: "15px" }}>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <div style={{ width: "250px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "13px", color: "#666666" }}>Tạm tính:</span>
                    <span style={{ fontSize: "13px", color: "#333333" }}>{subtotal.toLocaleString()}đ</span>
                  </div>
                  {discount > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#666666" }}>Giảm giá:</span>
                      <span style={{ fontSize: "13px", color: "#8B4513" }}>-{discount.toLocaleString()}đ</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "#333333" }}>TỔNG CỘNG:</span>
                    <span style={{ fontSize: "18px", fontWeight: 700, color: "#dc2626" }}>{total.toLocaleString()}đ</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Thank You & QR Section */}
          <div style={{ padding: "25px 30px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <p style={{ fontSize: "24px", fontStyle: "italic", color: "#8B4513", margin: "0", fontFamily: "cursive" }}>
                Cảm ơn quý khách!
              </p>
              <div style={{ marginTop: "15px", fontSize: "12px", color: "#666666" }}>
                <p style={{ margin: "0 0 3px 0" }}><strong>STK:</strong> {settings.accountNumber}</p>
                <p style={{ margin: "0 0 3px 0" }}><strong>Tên TK:</strong> {settings.accountName}</p>
                <p style={{ margin: "0" }}><strong>Ngân hàng:</strong> {settings.bankName}</p>
              </div>
            </div>
            {qrCodeUrl && (
              <div style={{ textAlign: "center" }}>
                <img src={qrCodeUrl} alt="QR" style={{ width: "140px", height: "140px" }} />
                <p style={{ fontSize: "10px", color: "#888888", margin: "5px 0 0 0" }}>Quét QR để thanh toán</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ backgroundColor: "#8B4513", padding: "12px 30px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <p style={{ fontSize: "11px", color: "#ffffff", margin: 0 }}>📞 {settings.shopPhone}</p>
            <p style={{ fontSize: "12px", color: "#ffffff", margin: 0, fontWeight: 600 }}>{settings.shopName.toUpperCase()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
