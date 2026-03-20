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
  getAllUnits,
  addUnit,
  updateUnit,
  deleteUnit,
  Settings,
  Unit
} from "@/lib/db";
import { usePWA } from "@/hooks/usePWA";
import { 
  Download, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  Star,
  Building2
} from "lucide-react";
import { 
  getAllBankAccounts, 
  addBankAccount, 
  updateBankAccount, 
  deleteBankAccount, 
  setDefaultBankAccount,
  BankAccount
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
  const [showDebug, setShowDebug] = useState(false);
  const { isInstallable, isInstalled, isIOS, install } = usePWA();

  // Units state
  const [units, setUnits] = useState<Unit[]>([]);
  const [showUnits, setShowUnits] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showBankAccounts, setShowBankAccounts] = useState(false);
  const [isAddingBank, setIsAddingBank] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [newBank, setNewBank] = useState<Omit<BankAccount, 'id' | 'isDefault'>>({
    bankName: "MB Bank",
    bankBin: "970422",
    accountNumber: "",
    accountName: "",
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        await migrateFromLocalStorage();
        await initDefaultSettings();
        const [data, unitsData, bankData] = await Promise.all([
          getSettings(),
          getAllUnits(),
          getAllBankAccounts(),
        ]);
        if (data) {
          setSettings(data);
        }
        setUnits(unitsData);
        setBankAccounts(bankData);
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

  // Units handlers
  const handleAddUnit = async () => {
    if (!newUnitName.trim()) return;
    try {
      const unit = await addUnit(newUnitName.trim());
      setUnits([...units, unit]);
      setNewUnitName("");
    } catch (error) {
      console.error("Error adding unit:", error);
    }
  };

  const handleUpdateUnit = async () => {
    if (!editingUnit || !editingUnit.name.trim()) return;
    try {
      await updateUnit(editingUnit);
      setUnits(units.map((u) => (u.id === editingUnit.id ? editingUnit : u)));
      setEditingUnit(null);
    } catch (error) {
      console.error("Error updating unit:", error);
    }
  };

  const handleDeleteUnit = async (id: string) => {
    try {
      await deleteUnit(id);
      setUnits(units.filter((u) => u.id !== id));
    } catch (error) {
      console.error("Error deleting unit:", error);
    }
  };

  // Bank accounts handlers
  const handleAddBank = async () => {
    if (!newBank.accountNumber || !newBank.accountName) return;
    try {
      const added = await addBankAccount({ ...newBank, isDefault: bankAccounts.length === 0 ? 1 : 0 });
      setBankAccounts([...bankAccounts, added]);
      setNewBank({
        bankName: "MB Bank",
        bankBin: "970422",
        accountNumber: "",
        accountName: "",
      });
      setIsAddingBank(false);
      
      // If first bank account, it becomes default and updates settings
      if (bankAccounts.length === 0) {
        const updatedSettings = await getSettings();
        if (updatedSettings) setSettings(updatedSettings);
      }
    } catch (error) {
      console.error("Error adding bank account:", error);
    }
  };

  const handleUpdateBank = async () => {
    if (!editingBank || !editingBank.accountNumber || !editingBank.accountName) return;
    try {
      await updateBankAccount(editingBank);
      setBankAccounts(bankAccounts.map(b => b.id === editingBank.id ? editingBank : b));
      setEditingBank(null);
      
      // If this was the default account, refresh settings
      if (editingBank.isDefault === 1) {
        const updatedSettings = await getSettings();
        if (updatedSettings) setSettings(updatedSettings);
      }
    } catch (error) {
      console.error("Error updating bank account:", error);
    }
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xoá tài khoản này?")) return;
    try {
      await deleteBankAccount(id);
      setBankAccounts(bankAccounts.filter(b => b.id !== id));
    } catch (error) {
      console.error("Error deleting bank account:", error);
    }
  };

  const handleSetDefaultBank = async (id: string) => {
    try {
      await setDefaultBankAccount(id);
      setBankAccounts(bankAccounts.map(b => ({
        ...b,
        isDefault: b.id === id ? 1 : 0
      })));
      
      // Refresh settings to show the new default bank
      const updatedSettings = await getSettings();
      if (updatedSettings) setSettings(updatedSettings);
    } catch (error) {
      console.error("Error setting default bank account:", error);
    }
  };

  const handleNewBankSelect = (bankName: string) => {
    const bank = bankList.find((b) => b.name === bankName);
    if (bank) {
      setNewBank(prev => ({ ...prev, bankName: bank.name, bankBin: bank.bin }));
    }
  };

  const handleEditingBankSelect = (bankName: string) => {
    const bank = bankList.find((b) => b.name === bankName);
    if (bank && editingBank) {
      setEditingBank({ ...editingBank, bankName: bank.name, bankBin: bank.bin });
    }
  };
 

  // Preview VietQR
  const previewQRUrl = settings.accountNumber && settings.bankBin
    ? `https://img.vietqr.io/image/${settings.bankBin}-${settings.accountNumber}-cdHGLoP.png?amount=100000&addInfo=Ten%20Khach%20Hang&accountName=${encodeURIComponent(settings.accountName)}`
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
            Sử dụng VietQR để tự động tạo mã QR thanh toán với số tiền và nội dung. Tài khoản đang sử dụng sẽ được lấy từ danh sách phía dưới.
          </p>
 
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Ngân hàng</label>
                <div className="p-2 bg-gray-800 border border-gray-700 rounded-md text-white font-medium">
                  {settings.bankName || "Chưa chọn"}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-400">Số tài khoản</label>
                <div className="p-2 bg-gray-800 border border-gray-700 rounded-md text-white font-mono">
                  {settings.accountNumber || "Chưa có"}
                </div>
              </div>
            </div>
 
            <div className="space-y-1">
              <label className="text-xs text-gray-400">Tên chủ tài khoản</label>
              <div className="p-2 bg-gray-800 border border-gray-700 rounded-md text-white font-bold uppercase">
                {settings.accountName || "Chưa có"}
              </div>
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
            
            <p className="text-[10px] text-amber-500/70 italic text-center">
              * Để thay đổi tài khoản, vui lòng chọn từ danh sách tài khoản phía dưới.
            </p>
          </div>
        </CardContent>
      </Card>
 
      {/* Bank Accounts Management */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4">
          <button
            onClick={() => setShowBankAccounts(!showBankAccounts)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Star size={20} className="text-amber-500" />
              Danh sách tài khoản (STK)
            </h2>
            {showBankAccounts ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
 
          {showBankAccounts && (
            <div className="mt-4 space-y-4">
              {/* Add new bank account button */}
              {!isAddingBank && !editingBank && (
                <Button 
                  onClick={() => setIsAddingBank(true)}
                  className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 gap-2"
                >
                  <Plus size={16} /> Thêm tài khoản mới
                </Button>
              )}
 
              {/* Add/Edit Form */}
              {(isAddingBank || editingBank) && (
                <div className="p-3 bg-gray-800/30 rounded-lg border border-gray-700 space-y-3">
                  <h3 className="text-sm font-medium text-amber-500 font-bold">
                    {editingBank ? "SỬA TÀI KHOẢN" : "THÊM TÀI KHOẢN MỚI"}
                  </h3>
                  
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Ngân hàng</label>
                      <select
                        value={editingBank ? editingBank.bankName : newBank.bankName}
                        onChange={(e) => editingBank ? handleEditingBankSelect(e.target.value) : handleNewBankSelect(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-700 rounded-md text-white text-sm"
                      >
                        {bankList.map((bank) => (
                          <option key={bank.bin} value={bank.name}>
                            {bank.name}
                          </option>
                        ))}
                      </select>
                    </div>
 
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Số tài khoản</label>
                      <Input
                        placeholder="VD: 0988885192"
                        value={editingBank ? editingBank.accountNumber : newBank.accountNumber}
                        onChange={(e) => editingBank 
                          ? setEditingBank({...editingBank, accountNumber: e.target.value}) 
                          : setNewBank({...newBank, accountNumber: e.target.value})}
                        className="bg-gray-900 border-gray-700 h-9 text-sm"
                      />
                    </div>
 
                    <div className="space-y-1">
                      <label className="text-xs text-gray-400">Tên chủ TK (không dấu)</label>
                      <Input
                        placeholder="VD: PHAM THI HONG NHUNG"
                        value={editingBank ? editingBank.accountName : newBank.accountName}
                        onChange={(e) => {
                          const val = e.target.value.toUpperCase();
                          editingBank 
                            ? setEditingBank({...editingBank, accountName: val}) 
                            : setNewBank({...newBank, accountName: val})
                        }}
                        className="bg-gray-900 border-gray-700 h-9 text-sm"
                      />
                    </div>
                  </div>
 
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1 bg-amber-600 hover:bg-amber-500 text-white h-9 text-sm font-bold"
                      onClick={editingBank ? handleUpdateBank : handleAddBank}
                    >
                      {editingBank ? "LƯU" : "THÊM"}
                    </Button>
                    <Button 
                      variant="ghost" 
                      className="flex-1 h-9 text-sm"
                      onClick={() => {
                        setIsAddingBank(false);
                        setEditingBank(null);
                      }}
                    >
                      Hủy
                    </Button>
                  </div>
                </div>
              )}
 
              {/* Accounts List */}
              <div className="space-y-2">
                {bankAccounts.map((bank) => (
                  <div
                    key={bank.id}
                    onClick={() => bank.isDefault === 0 && handleSetDefaultBank(bank.id)}
                    className={`p-3 rounded-lg border transition-all duration-200 ${
                      bank.isDefault 
                        ? "bg-amber-900/20 border-amber-500/50" 
                        : "bg-gray-800/50 border-gray-700 hover:border-amber-500/30 hover:bg-gray-800 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex gap-3">
                        <div className={`p-2 rounded-md ${bank.isDefault ? "bg-amber-500/20 text-amber-500" : "bg-gray-700 text-gray-400"}`}>
                          <Building2 size={18} />
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-white">{bank.bankName}</span>
                            {bank.isDefault === 1 && (
                              <span className="text-[10px] bg-amber-600 px-1.5 py-0.5 rounded text-white font-bold">MẶC ĐỊNH</span>
                            )}
                          </div>
                          <p className="text-sm font-mono text-gray-300">{bank.accountNumber}</p>
                          <p className="text-[10px] text-gray-500 font-bold">{bank.accountName}</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {bank.isDefault === 0 ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSetDefaultBank(bank.id)}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-amber-500"
                            title="Đặt làm mặc định"
                          >
                            <Star size={16} />
                          </Button>
                        ) : (
                          <div className="h-8 w-8 flex items-center justify-center text-amber-500">
                            <Star size={16} fill="currentColor" />
                          </div>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingBank(bank)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteBank(bank.id)}
                          className="h-8 w-8 p-0 text-red-500/70 hover:text-red-400"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {bankAccounts.length === 0 && !isAddingBank && (
                  <p className="text-center text-gray-500 text-sm py-4 italic">
                    Chưa có tài khoản nào được lưu
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Units Management */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4">
          <button
            onClick={() => setShowUnits(!showUnits)}
            className="w-full flex items-center justify-between"
          >
            <h2 className="font-semibold text-white flex items-center gap-2">
              📏 Đơn vị tính
            </h2>
            {showUnits ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>

          {showUnits && (
            <div className="mt-4 space-y-3">
              {/* Add new unit */}
              <div className="flex gap-2">
                <Input
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddUnit()}
                  placeholder="Thêm đơn vị mới..."
                  className="bg-gray-800 border-gray-700 flex-1"
                />
                <Button
                  onClick={handleAddUnit}
                  disabled={!newUnitName.trim()}
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-500"
                >
                  <Plus size={16} />
                </Button>
              </div>

              {/* Units list */}
              <div className="space-y-2">
                {units.map((unit) => (
                  <div
                    key={unit.id}
                    className="flex items-center gap-2 p-2 bg-gray-800/50 rounded-lg"
                  >
                    {editingUnit?.id === unit.id ? (
                      <>
                        <Input
                          value={editingUnit.name}
                          onChange={(e) =>
                            setEditingUnit({ ...editingUnit, name: e.target.value })
                          }
                          onKeyDown={(e) => e.key === "Enter" && handleUpdateUnit()}
                          className="bg-gray-800 border-gray-700 flex-1 h-8"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleUpdateUnit} className="h-8 bg-amber-600">
                          Lưu
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingUnit(null)} className="h-8">
                          Hủy
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{unit.name}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingUnit(unit)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                        >
                          <Pencil size={14} />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteUnit(unit.id)}
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </>
                    )}
                  </div>
                ))}
                {units.length === 0 && (
                  <p className="text-center text-gray-500 text-sm py-4">
                    Chưa có đơn vị nào
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* PWA Install Button / Instructions */}
      {!isInstalled && (
        <Card className="bg-amber-900/20 border-amber-800/50">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                <Download size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-amber-500">Cài đặt ứng dụng</h3>
                <p className="text-xs text-amber-200/60">
                  {isIOS 
                    ? "Để cài đặt trên iOS, nhấn nút Chia sẻ và chọn 'Thêm vào MH chính'" 
                    : "Cài đặt để sử dụng mượt mà hơn và truy cập nhanh từ màn hình chính"}
                </p>
              </div>
            </div>
            
            {isInstallable ? (
              <Button
                onClick={install}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold"
              >
                Cài đặt ngay
              </Button>
            ) : isIOS ? (
              <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <p className="text-xs text-amber-200/80 leading-relaxed">
                  1. Nhấn vào biểu tượng <strong>Chia sẻ</strong> (ô vuông có mũi tên lên) ở thanh công cụ trình duyệt.<br/>
                  2. Cuộn xuống và chọn <strong>Thêm vào MH chính</strong> (Add to Home Screen).
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">
                Trình duyệt của bạn có thể không hỗ trợ cài đặt tự động. Hãy thử sử dụng Chrome hoặc Edge.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Debug Info (Hidden by default, click version to show) */}
      {showDebug && (
        <Card className="bg-gray-900 border-dashed border-gray-700">
          <CardContent className="p-3 space-y-1 text-[10px] font-mono text-gray-500">
            <p>PWA Debug Info:</p>
            <p>isInstallable: {String(isInstallable)}</p>
            <p>isInstalled: {String(isInstalled)}</p>
            <p>isIOS: {String(isIOS)}</p>
            <p>Protocol: {typeof window !== 'undefined' ? window.location.protocol : 'N/A'}</p>
            <p>ServiceWorker: {typeof navigator !== 'undefined' && 'serviceWorker' in navigator ? 'Supported' : 'Not Supported'}</p>
            <p>UserAgent: {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}</p>
          </CardContent>
        </Card>
      )}

      {/* Save Button */}
      <Button
        onClick={handleSave}
        className="w-full bg-amber-600 hover:bg-amber-500"
      >
        {saved ? "✓ Đã lưu" : "Lưu cài đặt"}
      </Button>

      {/* Version */}
      <p 
        className="text-center text-xs text-gray-600 cursor-help"
        onClick={() => setShowDebug(!showDebug)}
      >
        Le Farm - Bill App v1.3.0 (D1 Cloud)
      </p>
    </div>
  );
}
