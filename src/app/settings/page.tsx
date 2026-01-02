"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  getSettings, 
  saveSettings, 
  migrateFromLocalStorage, 
  initDefaultSettings,
  Settings 
} from "@/lib/db";

// VietQR bank list with BIN codes
const bankList = [
  { name: "MB Bank", bin: "970422" },
  { name: "Vietcombank", bin: "970436" },
  { name: "Techcombank", bin: "970407" },
  { name: "BIDV", bin: "970418" },
  { name: "Agribank", bin: "970405" },
  { name: "VPBank", bin: "970432" },
  { name: "TPBank", bin: "970423" },
  { name: "ACB", bin: "970416" },
  { name: "Sacombank", bin: "970403" },
  { name: "VietinBank", bin: "970415" },
  { name: "SHB", bin: "970443" },
  { name: "MSB", bin: "970426" },
  { name: "OCB", bin: "970448" },
  { name: "SeABank", bin: "970440" },
  { name: "HDBank", bin: "970437" },
];

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        await migrateFromLocalStorage();
        await initDefaultSettings();
        const data = await getSettings();
        if (data) {
          setSettings(data);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      await saveSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const handleChange = (key: keyof Settings, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleBankSelect = (bankName: string) => {
    const bank = bankList.find((b) => b.name === bankName);
    if (bank) {
      setSettings((prev) => ({
        ...prev,
        bankName: bank.name,
        bankBin: bank.bin,
      }));
    }
  };

  // Preview VietQR
  const previewQRUrl = settings.accountNumber && settings.bankBin
    ? `https://img.vietqr.io/image/${settings.bankBin}-${settings.accountNumber}-compact2.png?amount=100000&addInfo=Test&accountName=${encodeURIComponent(settings.accountName)}`
    : "";

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
      <h1 className="text-xl font-bold text-amber-500">Cài đặt</h1>

      {/* Shop Info */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            🏪 Thông tin cửa hàng
          </h2>
          
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-gray-400">Tên cửa hàng</label>
              <Input
                placeholder="VD: Hạt điều Tinh Hoa Việt"
                value={settings.shopName}
                onChange={(e) => handleChange("shopName", e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-400">Địa chỉ</label>
              <Input
                placeholder="VD: TT Tân Khai, H. Hớn Quản..."
                value={settings.shopAddress}
                onChange={(e) => handleChange("shopAddress", e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-400">Số điện thoại</label>
              <Input
                placeholder="VD: 0349 939 393"
                value={settings.shopPhone}
                onChange={(e) => handleChange("shopPhone", e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-400">Link logo (URL)</label>
              <Input
                placeholder="https://..."
                value={settings.shopLogo}
                onChange={(e) => handleChange("shopLogo", e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Settings - VietQR */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4 space-y-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
            </svg>
            VietQR - Thanh toán
          </h2>

          <p className="text-xs text-gray-400">
            Sử dụng VietQR để tự động tạo mã QR thanh toán với số tiền và nội dung
          </p>

          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-sm text-gray-400">Ngân hàng</label>
              <select
                value={settings.bankName}
                onChange={(e) => handleBankSelect(e.target.value)}
                className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
              >
                {bankList.map((bank) => (
                  <option key={bank.bin} value={bank.name}>
                    {bank.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-400">Số tài khoản</label>
              <Input
                placeholder="VD: 0988885192"
                value={settings.accountNumber}
                onChange={(e) => handleChange("accountNumber", e.target.value)}
                className="bg-gray-800 border-gray-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm text-gray-400">Tên chủ tài khoản (không dấu, viết hoa)</label>
              <Input
                placeholder="VD: PHAM THI HONG NHUNG"
                value={settings.accountName}
                onChange={(e) => handleChange("accountName", e.target.value.toUpperCase())}
                className="bg-gray-800 border-gray-700"
              />
            </div>

            {/* QR Preview */}
            {previewQRUrl && (
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Xem trước QR (100,000đ)</label>
                <div className="flex justify-center p-4 bg-white rounded-lg">
                  <img
                    src={previewQRUrl}
                    alt="VietQR Preview"
                    className="max-w-[200px] h-auto object-contain"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        onClick={handleSave}
        className="w-full bg-amber-600 hover:bg-amber-500"
      >
        {saved ? "✓ Đã lưu" : "Lưu cài đặt"}
      </Button>

      {/* Version */}
      <p className="text-center text-xs text-gray-600">
        Le Farm - Bill App v1.2.0 (IndexedDB)
      </p>
    </div>
  );
}
