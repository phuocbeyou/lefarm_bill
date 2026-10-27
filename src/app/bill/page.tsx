"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import QRCode from "qrcode";
import { 
  getAllProducts, 
  getSettings, 
  getAllCustomers,
  saveBill,
  migrateFromLocalStorage, 
  initDefaultSettings,
  getAllBankAccounts,
  Product,
  Settings,
  Customer,
  BankAccount
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

function removeVietnameseAccents(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const bytes = new TextEncoder().encode(payload);
  for (let i = 0; i < bytes.length; i++) {
    crc ^= bytes[i] << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
    }
  }
  crc &= 0xffff;
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatTLV(tag: string, value: string): string {
  const length = new TextEncoder().encode(value).length.toString().padStart(2, "0");
  return `${tag}${length}${value}`;
}

function generateVietQRPayload(params: {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  content?: string;
}): string {
  let qr = "000201";
  qr += formatTLV("01", params.amount && params.amount > 0 ? "12" : "11");
  const guid = formatTLV("00", "A000000727");
  const acquirerData = formatTLV("00", params.bankBin) + formatTLV("01", params.accountNumber);
  const field38_01 = formatTLV("01", acquirerData);
  const field38_02 = formatTLV("02", "QRIBFTTA");
  qr += formatTLV("38", guid + field38_01 + field38_02);
  qr += formatTLV("52", "0000");
  qr += formatTLV("53", "704");
  if (params.amount && params.amount > 0) {
    qr += formatTLV("54", Math.round(params.amount).toString());
  }
  qr += formatTLV("58", "VN");
  if (params.content && params.content.trim()) {
    const cleanContent = removeVietnameseAccents(params.content.trim());
    qr += formatTLV("62", formatTLV("08", cleanContent));
  }
  qr += "6304";
  qr += calculateCRC16(qr);
  return qr;
}

async function generateVietQRPng(params: {
  bankBin: string;
  accountNumber: string;
  amount?: number;
  content?: string;
}): Promise<string> {
  const payload = generateVietQRPayload(params);
  return await QRCode.toDataURL(payload, {
    width: 400,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

const EXPORT_SCALE = 2;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawImageOnCanvas(
  canvas: HTMLCanvasElement,
  box: { x: number; y: number; w: number; h: number },
  img: HTMLImageElement
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // html2canvas leaves its scale/translate on this context; draw in raw canvas pixels
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.drawImage(img, box.x, box.y, box.w, box.h);
}

// Renders the export template, then paints QR + logo on top so they are always visible
// (html2canvas sometimes drops images, seen on Safari).
async function renderBillCanvas(el: HTMLElement, qrSrc: string) {
  // ponytail: overlay boxes are measured inside html2canvas's clone, not the live DOM —
  // the clone has Tailwind stripped (line-height etc.), so its layout differs from the screen.
  const boxes: { kind: string; x: number; y: number; w: number; h: number }[] = [];
  const canvas = await html2canvas(el, {
    scale: EXPORT_SCALE,
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
      const root = clonedDoc.querySelector<HTMLElement>("[data-export-template]");
      if (!root) return;
      const r = root.getBoundingClientRect();
      root.querySelectorAll<HTMLElement>("[data-overlay]").forEach((node) => {
        const b = node.getBoundingClientRect();
        boxes.push({
          kind: node.dataset.overlay || "",
          x: (b.left - r.left) * EXPORT_SCALE,
          y: (b.top - r.top) * EXPORT_SCALE,
          w: b.width * EXPORT_SCALE,
          h: b.height * EXPORT_SCALE,
        });
      });
    },
  });
  for (const box of boxes) {
    try {
      if (box.kind === "qr") {
        if (qrSrc) drawImageOnCanvas(canvas, box, await loadImage(qrSrc));
      } else {
        // ponytail: reuse the already-loaded on-page logo; re-fetching it failed on Safari
        const live = el.querySelector<HTMLImageElement>('img[data-overlay="logo"]');
        const img = live?.complete && live.naturalWidth ? live : await loadImage("/logo.jpg");
        drawImageOnCanvas(canvas, box, img);
      }
    } catch (err) {
      console.error("overlay draw error:", box.kind, err);
    }
  }
  return canvas;
}

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
  const [toastMessage, setToastMessage] = useState("");
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Bank state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  
  // Autocomplete state
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const customerInputRef = useRef<HTMLDivElement>(null);

  const billRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [qrBase64, setQrBase64] = useState<string>("");
  const [billThemeNew, setBillThemeNew] = useState(false);

  useEffect(() => {
    setToday(new Date().toLocaleDateString("vi-VN"));
    try { setBillThemeNew(localStorage.getItem("billThemeNew") === "true"); } catch {}

    const loadData = async () => {
      try {
        await migrateFromLocalStorage();
        await initDefaultSettings();
        
        const [productsData, settingsData, customersData, banksData] = await Promise.all([
          getAllProducts(),
          getSettings(),
          getAllCustomers(),
          getAllBankAccounts(),
        ]);
        
        setProducts(productsData);
        setCustomers(customersData);
        setBankAccounts(banksData);

        if (settingsData) {
          setSettings(settingsData);
        }

        // Set default bank if available
        const defaultBank = banksData.find(b => b.isDefault === 1) || banksData[0];
        if (defaultBank) {
          setSelectedBankId(defaultBank.id);
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
        item.id === itemId ? { ...item, price: Math.max(0, price) } : item
      )
    );
  };

  const handleQuantityChange = (itemId: string, quantity: number) => {
    setBillItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(0, quantity) } : item
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
  const appliedDiscount = Math.min(discount, subtotal);
  const total = subtotal - appliedDiscount;
  const validItems = billItems.filter((item) => item.productId && item.quantity > 0);

  useEffect(() => {
    setDiscount((currentDiscount) => Math.min(currentDiscount, subtotal));
  }, [subtotal]);

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 3000);
  };

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
  }, []);

  const generateVietQRUrl = () => {
    const selectedBank = bankAccounts.find(b => b.id === selectedBankId);
    
    // Use selected bank or fallback to settings
    const bankBin = selectedBank?.bankBin || settings.bankBin || "970422";
    const accountNumber = selectedBank?.accountNumber || settings.accountNumber;
    const accountName = selectedBank?.accountName || settings.accountName;

    if (!accountNumber) return "";
    
    const description = customerName || "";
    const amount = total > 0 ? `amount=${total}` : "";
    const params = [amount, `addInfo=${encodeURIComponent(description)}`, `accountName=${encodeURIComponent(accountName)}`].filter(Boolean).join("&");
    return `https://img.vietqr.io/image/${bankBin}-${accountNumber}-cdHGLoP.png?${params}`;
  };

  const qrCodeUrl = generateVietQRUrl();

  useEffect(() => {
    let isMounted = true;
    const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);
    const bankBin = selectedBank?.bankBin || settings.bankBin || "970422";
    const accountNumber = selectedBank?.accountNumber || settings.accountNumber;

    if (!accountNumber) {
      setQrBase64("");
      return;
    }

    generateVietQRPng({
      bankBin,
      accountNumber,
      amount: total > 0 ? total : undefined,
      content: customerName || undefined,
    })
      .then((dataUrl) => {
        if (isMounted) {
          setQrBase64(dataUrl);
        }
      })
      .catch((err) => console.error("VietQR PNG error:", err));

    return () => {
      isMounted = false;
    };
  }, [bankAccounts, selectedBankId, settings, total, customerName]);

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

    // ponytail: Safari only honors <a download>.click() while user activation is alive,
    // and silently drops oversized data: URLs. So: render + download FIRST with no network
    // await in front of it, use a Blob URL instead of toDataURL, save to DB afterwards.
    try {
      let pngData = qrBase64;
      if (!pngData) {
        const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);
        const bankBin = selectedBank?.bankBin || settings.bankBin || "970422";
        const accountNumber = selectedBank?.accountNumber || settings.accountNumber;
        if (accountNumber) {
          pngData = await generateVietQRPng({
            bankBin,
            accountNumber,
            amount: total > 0 ? total : undefined,
            content: customerName || undefined,
          });
          setQrBase64(pngData);
        }
      }

      const canvas = await renderBillCanvas(exportRef.current, pngData);
      
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png")
      );
      if (!blob) throw new Error("canvas.toBlob returned null");

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `hoadon_${orderCode || Date.now()}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      console.error("Export image error:", error);
    }

    // Separate try: a failed export must not skip saving the bill
    try {
      await saveBill({
        customerName,
        customerPhone,
        customerAddress,
        orderCode,
        items: validItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          price: item.price,
        })),
        subtotal,
        discount: appliedDiscount,
        total,
      });
    } catch (error) {
      console.error("Save bill error:", error);
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!exportRef.current) return;
    setExporting(true);
    setShowExportMenu(false);

    try {
      let pngData = qrBase64;
      if (!pngData) {
        const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);
        const bankBin = selectedBank?.bankBin || settings.bankBin || "970422";
        const accountNumber = selectedBank?.accountNumber || settings.accountNumber;
        if (accountNumber) {
          pngData = await generateVietQRPng({
            bankBin,
            accountNumber,
            amount: total > 0 ? total : undefined,
            content: customerName || undefined,
          });
          setQrBase64(pngData);
        }
      }

      const canvas = await renderBillCanvas(exportRef.current, pngData);
      
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const imgWidth = 190;
      const pageTop = 10;
      const pageBottom = 10;
      const pageContentHeight = 297 - pageTop - pageBottom;
      const sourceSliceHeight = Math.floor((pageContentHeight / imgWidth) * canvas.width);
      let sourceY = 0;
      let pageIndex = 0;

      while (sourceY < canvas.height) {
        const sliceHeight = Math.min(sourceSliceHeight, canvas.height - sourceY);
        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeight;
        const pageContext = pageCanvas.getContext("2d");
        if (!pageContext) throw new Error("Unable to create PDF page canvas");
        pageContext.drawImage(canvas, 0, sourceY, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

        if (pageIndex > 0) pdf.addPage();
        const sliceData = pageCanvas.toDataURL("image/png");
        const sliceMmHeight = (sliceHeight * imgWidth) / canvas.width;
        pdf.addImage(sliceData, "PNG", 10, pageTop, imgWidth, sliceMmHeight);

        sourceY += sliceHeight;
        pageIndex += 1;
      }
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
    <div className="mx-auto max-w-5xl space-y-5 p-4 pb-24 sm:p-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Bán hàng</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">Tạo phiếu bán hàng</h1>
          <p className="mt-1 text-sm text-gray-500">Nhập thông tin đơn hàng, kiểm tra tổng tiền rồi xuất hóa đơn.</p>
        </div>
        <span className="hidden rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 sm:inline-flex">{today || "Hôm nay"}</span>
      </div>
      {/* Bill Card - Input Form */}
      <Card className="overflow-hidden rounded-2xl border border-gray-200 bg-white text-gray-800 shadow-sm" ref={billRef}>
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-900 via-amber-800 to-orange-800 p-5 text-white sm:p-6">
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
            <div>
              <h2 className="text-lg font-bold text-gray-900">Thông tin đơn hàng</h2>
              <p className="mt-0.5 text-xs text-gray-500">Ngày lập: {today}</p>
            </div>
            {orderCode && <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700">#{orderCode}</span>}
          </div>

          {/* Customer Info */}
          <section className="space-y-2.5">
            <h3 className="text-sm font-semibold text-gray-700">Thông tin khách hàng</h3>
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
          </section>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Input
              value={orderCode}
              onChange={(e) => setOrderCode(e.target.value)}
              placeholder="Mã đơn hàng"
              className="h-9 text-sm bg-gray-50 border-gray-200"
            />
            <Input
              type="number"
              min={0}
              max={subtotal}
              value={appliedDiscount || ""}
              onChange={(e) => {
                const enteredDiscount = Number(e.target.value) || 0;
                if (enteredDiscount > subtotal) {
                  showToast(`Giảm giá không thể lớn hơn tạm tính ${subtotal.toLocaleString()}đ.`);
                }
                setDiscount(Math.min(Math.max(0, enteredDiscount), subtotal));
              }}
              placeholder="Giảm giá (đ)"
              className="h-9 text-sm bg-gray-50 border-gray-200"
            />
          </div>

          {/* Product List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Chi tiết sản phẩm</h3>
                <p className="mt-0.5 text-xs text-gray-500">{validItems.length} sản phẩm trong đơn</p>
              </div>
              <button onClick={addRow} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100">
                + Thêm dòng
              </button>
            </div>

            {billItems.map((item, index) => (
              <div key={item.id} className="space-y-2.5 rounded-xl border border-gray-200 bg-gray-50/70 p-3 sm:p-4">
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
                        min="0"
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
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Tạm tính:</span>
              <span>{subtotal.toLocaleString()}đ</span>
            </div>
            {appliedDiscount > 0 && (
              <div className="flex justify-between text-sm text-amber-600">
                <span>Giảm giá:</span>
                <span>-{appliedDiscount.toLocaleString()}đ</span>
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

              {/* Bank Selection */}
              <select
                value={selectedBankId}
                onChange={(e) => setSelectedBankId(e.target.value)}
                className="w-full max-w-[240px] p-2 bg-gray-50 border border-amber-100 rounded-lg text-xs font-medium text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                {bankAccounts.length > 0 ? (
                  bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.bankName} - {b.accountNumber}
                    </option>
                  ))
                ) : (
                  <option value="">{settings.bankName || "MB Bank"} - {settings.accountNumber}</option>
                )}
              </select>

              <div className="bg-white p-3 rounded-2xl shadow-inner border border-gray-100">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl || qrBase64} alt="VietQR" className="w-52 h-52 object-contain" />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center text-gray-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
                    </svg>
                  </div>
                )}
              </div>
              <div className="text-center">
                {(() => {
                  const currentBank = bankAccounts.find(b => b.id === selectedBankId);
                  const accountNumber = currentBank?.accountNumber || settings.accountNumber;
                  const bankName = currentBank?.bankName || settings.bankName;
                  const accountName = currentBank?.accountName || settings.accountName;
                  
                  return (
                    <>
                      <p className="text-sm font-bold text-gray-800">{accountNumber}</p>
                      <p className="text-[10px] text-gray-500 uppercase">{bankName} - {accountName}</p>
                    </>
                  );
                })()}
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

      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-medium text-white shadow-xl"
        >
          {toastMessage}
        </div>
      )}

      {/* Hidden Export Template */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        {billThemeNew ? (() => {
          const currentBank = bankAccounts.find(b => b.id === selectedBankId);
          const accountNumber = currentBank?.accountNumber || settings.accountNumber;
          const bankName = currentBank?.bankName || settings.bankName;
          const accountName = currentBank?.accountName || settings.accountName;
          const fmt = (n: number) => n.toLocaleString("de-DE") + " đ";
          const brand = "#78350f";
          const brandLight = "#fffbeb";
          const text = "#111827";
          const muted = "#6b7280";
          const line = "#e7d8c7";
          const th = { padding: "10px 7px", fontSize: "11px", fontWeight: 700, color: brand, backgroundColor: "#faf4eb", border: `1px solid ${line}` };
          const td = { padding: "9px 7px", height: "34px", fontSize: "12px", color: text, border: `1px solid ${line}` };
          const row = { display: "flex", justifyContent: "space-between", gap: "16px", padding: "6px 0", fontSize: "13px" };
          const info = { fontSize: "13px", margin: "0 0 7px 0", color: text };
          const lbl = { color: muted };
          const minVisibleRows = 6;
          const emptyRows = Array.from({ length: Math.max(0, minVisibleRows - validItems.length) });
          return (
            <div
              ref={exportRef}
              data-export-template="true"
              style={{
                width: "600px",
                backgroundColor: "#ffffff",
                fontFamily: "Arial, Helvetica, sans-serif",
                color: text,
                padding: "30px 34px",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "20px", borderBottom: `2px solid ${brand}`, marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <img data-overlay="logo" src="/logo.jpg" alt="Logo" style={{ width: "64px", height: "64px", borderRadius: "10px", objectFit: "cover" }} />
                  <div>
                    <p style={{ fontSize: "18px", fontWeight: 700, color: brand, margin: "0 0 5px 0" }}>{settings.shopName}</p>
                    <p style={{ fontSize: "12px", color: muted, margin: "0 0 2px 0" }}>{settings.shopAddress}</p>
                    <p style={{ fontSize: "12px", color: muted, margin: 0 }}>ĐT: {settings.shopPhone}</p>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ fontSize: "20px", fontWeight: 700, letterSpacing: "1px", color: brand, margin: "0 0 6px 0" }}>PHIẾU BÁN HÀNG</p>
                  <p style={{ fontSize: "12px", color: muted, margin: 0 }}>Ngày lập: {today}</p>
                  {orderCode && <p style={{ fontSize: "12px", color: muted, margin: "4px 0 0 0" }}>Mã hóa đơn: <b style={{ color: text }}>{orderCode}</b></p>}
                </div>
              </div>

              {/* Customer */}
              <div style={{ marginBottom: "14px", padding: "10px", backgroundColor: "#faf5ed", border: `1px solid ${line}`, borderRadius: "8px" }}>
                <p style={{ fontSize: "11px", fontWeight: 700, color: brand, letterSpacing: "0.5px", margin: "0 0 8px 3px" }}>THÔNG TIN KHÁCH HÀNG</p>
                <div style={{ display: "flex", gap: "0", padding: "9px 12px", backgroundColor: "#fff", border: `1px solid ${line}`, borderRadius: "7px" }}>
                  <p style={{ ...info, flex: 1, margin: 0, paddingRight: "10px" }}><span style={lbl}>Khách hàng:</span><br /><b>{customerName || "Khách lẻ"}</b></p>
                  <p style={{ ...info, flex: 1, margin: 0, padding: "0 12px", borderLeft: `1px solid ${line}` }}><span style={lbl}>Điện thoại:</span><br /><b>{customerPhone || "—"}</b></p>
                  <p style={{ ...info, flex: 1, margin: 0, paddingLeft: "12px", borderLeft: `1px solid ${line}` }}><span style={lbl}>Địa chỉ:</span><br /><b>{customerAddress || "—"}</b></p>
                </div>
              </div>

              {/* Product table */}
              <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", border: `1px solid ${line}` }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: "center", width: "38px" }}>#</th>
                    <th style={{ ...th, textAlign: "left" }}>Sản phẩm</th>
                    <th style={{ ...th, textAlign: "right", width: "70px" }}>Số lượng</th>
                    <th style={{ ...th, textAlign: "center", width: "48px" }}>ĐVT</th>
                    <th style={{ ...th, textAlign: "right", width: "96px" }}>Đơn giá</th>
                    <th style={{ ...th, textAlign: "right", width: "104px" }}>Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {validItems.map((item, idx) => (
                    <tr key={item.id}>
                      <td style={{ ...td, textAlign: "center", color: muted }}>{idx + 1}</td>
                      <td style={td}>{item.productName}</td>
                      <td style={{ ...td, textAlign: "right" }}>{item.quantity}</td>
                      <td style={{ ...td, textAlign: "center", color: muted }}>{item.unit && item.unit !== "-" ? item.unit : "—"}</td>
                      <td style={{ ...td, textAlign: "right" }}>{fmt(item.price)}</td>
                      <td style={{ ...td, textAlign: "right", fontWeight: 700 }}>{fmt(item.price * item.quantity)}</td>
                    </tr>
                  ))}
                  {emptyRows.map((_, idx) => (
                    <tr key={`empty-${idx}`} aria-hidden="true">
                      {Array.from({ length: 6 }, (_, cellIdx) => (
                        <td key={cellIdx} style={{ ...td, color: "transparent" }}>&nbsp;</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals */}
              <div style={{ display: "flex", width: "100%", marginBottom: "12px", border: `1px solid ${line}`, borderRadius: "8px", overflow: "hidden", backgroundColor: brandLight }}>
                <div style={{ flex: "0 0 55%", padding: "9px 14px" }}>
                  <div style={{ ...row, padding: "5px 0" }}><span style={{ color: brand }}>Tạm tính:</span><b>{fmt(subtotal)}</b></div>
                  <div style={{ ...row, padding: "5px 0", borderTop: `1px solid ${line}` }}><span style={{ color: brand }}>Giảm giá:</span><b>{fmt(appliedDiscount)}</b></div>
                </div>
                <div style={{ flex: 1, padding: "11px 14px", backgroundColor: brand, color: "#ffffff", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.4px" }}>KHÁCH CẦN TRẢ</span>
                  <span style={{ marginTop: "3px", fontSize: "23px", lineHeight: 1.2, fontWeight: 700 }}>{fmt(total)}</span>
                </div>
              </div>

              {/* Payment */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "18px", border: `1px solid ${line}`, borderRadius: "8px", padding: "12px 14px", marginBottom: "14px", backgroundColor: "#fffdfa" }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: "13px", fontWeight: 700, color: brand, margin: "0 0 9px 0" }}>THÔNG TIN THANH TOÁN</p>
                  <p style={{ ...row, justifyContent: "flex-start", margin: 0 }}><span style={{ ...lbl, width: "112px" }}>Ngân hàng:</span><b>{bankName}</b></p>
                  <p style={{ ...row, justifyContent: "flex-start", margin: 0 }}><span style={{ ...lbl, width: "112px" }}>Số tài khoản:</span><b>{accountNumber}</b></p>
                  <p style={{ ...row, justifyContent: "flex-start", margin: 0 }}><span style={{ ...lbl, width: "112px" }}>Chủ tài khoản:</span><b>{accountName}</b></p>
                </div>
                {(qrBase64 || qrCodeUrl) && (
                  <div style={{ minWidth: "150px", paddingLeft: "14px", borderLeft: `1px solid ${line}`, textAlign: "center" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: brand, margin: "0 0 5px 0" }}>Quét mã để thanh toán</p>
                    <div data-overlay="qr" style={{ width: "124px", height: "124px", display: "inline-block", padding: "4px", border: `1px solid ${line}`, borderRadius: "8px", backgroundColor: "#ffffff" }}>
                      <img src={qrBase64 || qrCodeUrl} alt="QR" style={{ width: "114px", height: "114px", objectFit: "contain" }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div style={{ borderTop: `1px solid ${line}`, paddingTop: "10px", textAlign: "center", fontSize: "11px", color: muted }}>
                <p style={{ margin: "0 0 4px 0", fontWeight: 700, color: brand }}>Cảm ơn quý khách đã mua hàng!</p>
                <p style={{ margin: 0 }}>Mã QR đã bao gồm số tiền và nội dung chuyển khoản. Thanh toán khi nhận hàng có thể bỏ qua phần chuyển khoản.</p>
              </div>
            </div>
          );
        })() : (
        <div 
          ref={exportRef} 
          data-export-template="true"
          style={{ 
            width: "600px", 
            backgroundColor: "#ffffff", 
            fontFamily: "'Times New Roman', serif",
            color: "#333333",
            padding: "25px 30px"
          }}
        >
          {/* Header Divider - TOP */}
          <div style={{ height: "4px", backgroundColor: "#283497", marginBottom: "20px" }}></div>

          {/* Header - Logo + Shop Info */}
          <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "20px" }}>
            <img data-overlay="logo" src="/logo.jpg" alt="Logo" style={{ width: "70px", height: "70px", borderRadius: "8px", objectFit: "cover" }} />
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#C6893F", margin: 0, fontFamily: "'Times New Roman', serif" }}>{settings.shopName}</h1>
              <p style={{ fontSize: "13px", color: "#333", margin: "5px 0 2px 0" }}>Địa chỉ: {settings.shopAddress}</p>
              <p style={{ fontSize: "13px", color: "#333", margin: 0 }}>SĐT: {settings.shopPhone}</p>
            </div>
          </div>

          {/* Title & Date */}
          <div style={{ marginBottom: "15px" }}>
            <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#283497", margin: 0, fontFamily: "'Times New Roman', serif" }}>Phiếu bán hàng</h2>
            <p style={{ fontSize: "14px", color: "#d63384", margin: "5px 0 0 0", fontWeight: 600 }}>{today}</p>
          </div>

          {/* Customer Info - 2 columns with box */}
          <div style={{ display: "flex", marginBottom: "20px", paddingBottom: "15px" }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: "13px", color: "#333", margin: "0 0 3px 0", fontWeight: 700 }}>Khách hàng</p>
              <p style={{ fontSize: "13px", color: "#333", margin: "0 0 8px 0" }}>{customerName || ""}</p>
              <p style={{ fontSize: "13px", color: "#333", margin: "0 0 3px 0", fontWeight: 700 }}>Địa chỉ</p>
              <p style={{ fontSize: "13px", color: "#333", margin: 0 }}>{customerAddress || ""}</p>
            </div>
            <div style={{ flex: 1, paddingLeft: "20px" }}>
              <p style={{ fontSize: "13px", color: "#333", margin: "0 0 3px 0", fontWeight: 700 }}>SĐT</p>
              <p style={{ fontSize: "13px", color: "#333", margin: "0 0 8px 0" }}>{customerPhone || ""}</p>
              <p style={{ fontSize: "13px", color: "#333", margin: "0 0 3px 0", fontWeight: 700 }}>Mã đơn hàng:</p>
              <p style={{ fontSize: "13px", color: "#333", margin: 0 }}>{orderCode || ""}</p>
            </div>
          </div>

          {/* Product Table */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "10px", borderTop: "2px solid #283497" }}>
            <thead>
              <tr>
                <th style={{ padding: "5px", textAlign: "center", verticalAlign: "middle", fontSize: "13px", fontWeight: 700, color: "#283497", width: "40px" }}>STT</th>
                <th style={{ padding: "5px", textAlign: "left", verticalAlign: "middle", fontSize: "13px", fontWeight: 700, color: "#283497" }}>Sản phẩm</th>
                <th style={{ padding: "5px", textAlign: "center", verticalAlign: "middle", fontSize: "13px", fontWeight: 700, color: "#283497", width: "70px" }}>Số lượng</th>
                <th style={{ padding: "5px", textAlign: "center", verticalAlign: "middle", fontSize: "13px", fontWeight: 700, color: "#283497", width: "50px" }}>ĐVT</th>
                <th style={{ padding: "5px", textAlign: "right", verticalAlign: "middle", fontSize: "13px", fontWeight: 700, color: "#283497", width: "90px" }}>Đơn giá</th>
                <th style={{ padding: "5px", textAlign: "right", verticalAlign: "middle", fontSize: "13px", fontWeight: 700, color: "#283497", width: "90px" }}>Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {validItems.map((item, idx) => (
                <tr key={item.id} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f5f5f5" }}>
                  <td style={{ padding: "8px 5px", fontSize: "13px", color: "#333", textAlign: "center" }}>{idx + 1}</td>
                  <td style={{ padding: "8px 5px", fontSize: "13px", color: "#333" }}>{item.productName}</td>
                  <td style={{ padding: "8px 5px", fontSize: "13px", color: "#333", textAlign: "center" }}>{item.quantity}</td>
                  <td style={{ padding: "8px 5px", fontSize: "13px", color: "#333", textAlign: "center" }}>{item.unit}</td>
                  <td style={{ padding: "8px 5px", fontSize: "13px", color: "#333", textAlign: "right" }}>{item.price.toLocaleString('de-DE')} đ</td>
                  <td style={{ padding: "8px 5px", fontSize: "13px", color: "#333", textAlign: "right" }}>{(item.price * item.quantity).toLocaleString('de-DE')} đ</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div style={{ paddingTop: "10px", marginBottom: "25px" }}>
            {appliedDiscount > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                <span style={{ fontSize: "13px", color: "#283497", fontWeight: 600 }}>Giảm giá</span>
                <span style={{ fontSize: "13px", color: "#333" }}></span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontSize: "14px", color: "#283497", fontWeight: 700 }}>Thành tiền</span>
              <span style={{ fontSize: "16px", color: "#d63384", fontWeight: 700 }}>{total.toLocaleString('de-DE')} đ</span>
            </div>
          </div>

          {/* Bank Transfer & QR Section */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
            <div>
              <p style={{ fontSize: "15px", color: "#283497", fontWeight: 700, margin: "0 0 12px 0", fontStyle: "italic" }}>Thông tin chuyển khoản:</p>
              {(() => {
                const currentBank = bankAccounts.find(b => b.id === selectedBankId);
                const accountNumber = currentBank?.accountNumber || settings.accountNumber;
                const bankName = currentBank?.bankName || settings.bankName;
                const accountName = currentBank?.accountName || settings.accountName;
                
                return (
                  <>
                    <p style={{ fontSize: "13px", color: "#333", margin: "0 0 5px 0" }}><strong>STK:</strong> {accountNumber}</p>
                    <p style={{ fontSize: "13px", color: "#333", margin: "0 0 5px 0" }}><strong>Tên TK:</strong> {accountName}</p>
                    <p style={{ fontSize: "13px", color: "#333", margin: "0" }}><strong>{bankName}</strong></p>
                  </>
                );
              })()}
            </div>
            {(qrBase64 || qrCodeUrl) && (
              <div style={{ textAlign: "center" }}>
                <div 
                  data-overlay="qr"
                  style={{ width: "150px", height: "150px", display: "inline-block" }}
                >
                  <img 
                    src={qrBase64 || qrCodeUrl} 
                    alt="QR" 
                    style={{ width: "150px", height: "150px", objectFit: "contain" }} 
                  />
                </div>
                <p style={{ fontSize: "9px", color: "#333", margin: "8px 0 0 0" }}>Thanh toán nhanh hơn với mã QR</p>
              </div>
            )}
          </div>

          {/* Footer Notes */}
          <div style={{ fontSize: "9px", color: "#666", paddingTop: "12px" }}>
            <p style={{ margin: "0 0 3px 0" }}>*Nếu quý chọn thanh toán khi nhận hàng vui lòng bỏ qua thông tin chuyển khoản này</p>
            <p style={{ margin: "0" }}>*Quét mã QR để thanh toán nhanh hơn (QR đã bao gồm số tiền và nội dung thanh toán)</p>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
