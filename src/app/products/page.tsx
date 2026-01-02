"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { 
  getAllProducts, 
  addProduct, 
  updateProduct, 
  deleteProduct, 
  getAllUnits, 
  initDefaultUnits,
  migrateFromLocalStorage,
  Product,
  Unit 
} from "@/lib/db";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [name, setName] = useState("");
  const [currentPrice, setCurrentPrice] = useState("");
  const [prices, setPrices] = useState<number[]>([]);
  const [unit, setUnit] = useState("KG");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load data from IndexedDB
  useEffect(() => {
    const loadData = async () => {
      try {
        await migrateFromLocalStorage();
        await initDefaultUnits();
        
        const [productsData, unitsData] = await Promise.all([
          getAllProducts(),
          getAllUnits(),
        ]);
        
        setProducts(productsData);
        setUnits(unitsData);
        
        if (unitsData.length > 0) {
          setUnit(unitsData[0].name);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const addPriceToList = () => {
    const p = Number(currentPrice);
    if (p > 0 && !prices.includes(p)) {
      setPrices([...prices, p].sort((a, b) => b - a));
      setCurrentPrice("");
    }
  };

  const removePriceFromList = (p: number) => {
    setPrices(prices.filter((price) => price !== p));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    // Ensure at least one price
    let finalPrices = [...prices];
    if (currentPrice) {
      const p = Number(currentPrice);
      if (p > 0 && !finalPrices.includes(p)) {
        finalPrices.push(p);
      }
    }
    finalPrices.sort((a, b) => b - a);

    if (finalPrices.length === 0) return;

    try {
      if (editingId) {
        const existing = products.find((p) => p.id === editingId);
        if (existing) {
          const updated: Product = {
            ...existing,
            name: name.trim(),
            price: finalPrices[0], // Main price is the highest one
            unit,
            priceHistory: finalPrices,
          };
          await updateProduct(updated);
          setProducts(products.map((p) => (p.id === editingId ? updated : p)));
        }
        setEditingId(null);
      } else {
        const newProduct = await addProduct({
          name: name.trim(),
          price: finalPrices[0],
          unit,
        });
        // Update with all prices
        const updated = { ...newProduct, priceHistory: finalPrices };
        await updateProduct(updated);
        setProducts([...products, updated]);
      }

      setName("");
      setCurrentPrice("");
      setPrices([]);
      if (units.length > 0) {
        setUnit(units[0].name);
      }
    } catch (error) {
      console.error("Error saving product:", error);
    }
  };

  const handleEdit = (product: Product) => {
    setEditingId(product.id);
    setName(product.name);
    setCurrentPrice("");
    setPrices(product.priceHistory || [product.price]);
    setUnit(product.unit || "KG");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Xác nhận xóa sản phẩm này?")) {
      try {
        await deleteProduct(id);
        setProducts(products.filter((p) => p.id !== id));
      } catch (error) {
        console.error("Error deleting product:", error);
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setName("");
    setCurrentPrice("");
    setPrices([]);
    if (units.length > 0) {
      setUnit(units[0].name);
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
      {/* Header */}
      <h1 className="text-xl font-bold text-amber-500">Quản lý sản phẩm</h1>

      {/* Add/Edit Form */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4 space-y-3">
          <Input
            placeholder="Tên sản phẩm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
          
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Nhập giá (VNĐ)"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addPriceToList()}
                  className="bg-gray-800 border-gray-700 flex-1"
                />
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addPriceToList}
                  className="border-amber-600 text-amber-500 hover:bg-amber-600/10"
                >
                  + Giá
                </Button>
              </div>
              
              {/* Prices List */}
              {prices.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-gray-800/50 rounded-lg border border-gray-800">
                  {prices.map((p) => (
                    <span key={p} className="bg-amber-600/20 text-amber-400 text-xs px-2 py-1 rounded-full flex items-center gap-1 border border-amber-600/30">
                      {p.toLocaleString()}đ
                      <button onClick={() => removePriceFromList(p)} className="hover:text-amber-200">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-md px-3 text-sm h-10"
            >
              {units.map((u) => (
                <option key={u.id} value={u.name}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-amber-600 hover:bg-amber-500"
              disabled={!name.trim() || (prices.length === 0 && !currentPrice)}
            >
              {editingId ? "Cập nhật" : "Thêm sản phẩm"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={handleCancel}>
                Hủy
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product List */}
      <div className="space-y-2">
        {products.map((product) => (
          <Card
            key={product.id}
            className={`bg-gray-900 border-gray-800 ${
              editingId === product.id ? "border-amber-500" : ""
            }`}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-400">
                    Đơn vị: <span className="text-amber-500">{product.unit}</span>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEdit(product)}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(product.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </Button>
                </div>
              </div>
              
              {/* Prices List */}
              <div className="mt-2 pt-2 border-t border-gray-800">
                <div className="flex flex-wrap gap-1">
                  {(product.priceHistory || [product.price]).map((p, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] bg-gray-800 text-amber-400 px-2 py-0.5 rounded border border-gray-700"
                    >
                      {p.toLocaleString()}đ
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {products.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Chưa có sản phẩm nào. Thêm sản phẩm mới ở trên.
          </p>
        )}
      </div>
    </div>
  );
}
