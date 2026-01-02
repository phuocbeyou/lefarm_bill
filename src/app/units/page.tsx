"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAllUnits, addUnit, updateUnit, deleteUnit, initDefaultUnits, Unit } from "@/lib/db";

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [newUnit, setNewUnit] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [loading, setLoading] = useState(true);

  // Load units from IndexedDB
  useEffect(() => {
    const loadUnits = async () => {
      try {
        await initDefaultUnits();
        const data = await getAllUnits();
        setUnits(data);
      } catch (error) {
        console.error("Error loading units:", error);
      } finally {
        setLoading(false);
      }
    };
    loadUnits();
  }, []);

  const handleAdd = async () => {
    if (!newUnit.trim()) return;
    
    try {
      const unit = await addUnit(newUnit.trim());
      setUnits([...units, unit]);
      setNewUnit("");
    } catch (error) {
      console.error("Error adding unit:", error);
    }
  };

  const handleEdit = (unit: Unit) => {
    setEditingId(unit.id);
    setEditingName(unit.name);
  };

  const handleUpdate = async () => {
    if (!editingId || !editingName.trim()) return;
    
    try {
      const unit = units.find((u) => u.id === editingId);
      if (unit) {
        const updated = { ...unit, name: editingName.trim() };
        await updateUnit(updated);
        setUnits(units.map((u) => (u.id === editingId ? updated : u)));
      }
      setEditingId(null);
      setEditingName("");
    } catch (error) {
      console.error("Error updating unit:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUnit(id);
      setUnits(units.filter((u) => u.id !== id));
    } catch (error) {
      console.error("Error deleting unit:", error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingName("");
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
      <h1 className="text-xl font-bold text-amber-500">Quản lý đơn vị tính</h1>

      {/* Add Form */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              placeholder="Nhập đơn vị mới (VD: Lọ, Bịch...)"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              className="bg-gray-800 border-gray-700 flex-1"
            />
            <Button
              onClick={handleAdd}
              disabled={!newUnit.trim()}
              className="bg-amber-600 hover:bg-amber-500"
            >
              Thêm
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Units List */}
      <div className="space-y-2">
        {units.map((unit) => (
          <Card key={unit.id} className={`bg-gray-900 border-gray-800 ${editingId === unit.id ? "border-amber-500" : ""}`}>
            <CardContent className="p-3 flex items-center justify-between">
              {editingId === unit.id ? (
                <div className="flex gap-2 flex-1">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                    className="bg-gray-800 border-gray-700 flex-1"
                    autoFocus
                  />
                  <Button size="sm" onClick={handleUpdate} className="bg-amber-600 hover:bg-amber-500">
                    Lưu
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    Hủy
                  </Button>
                </div>
              ) : (
                <>
                  <span className="font-medium">{unit.name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(unit)}
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
                      onClick={() => handleDelete(unit.id)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}

        {units.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            Chưa có đơn vị nào. Thêm đơn vị mới ở trên.
          </p>
        )}
      </div>
    </div>
  );
}
