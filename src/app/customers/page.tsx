"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAllCustomers, addCustomer, updateCustomer, deleteCustomer, Customer } from "@/lib/db";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Load customers from IndexedDB
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const data = await getAllCustomers();
        setCustomers(data);
      } catch (error) {
        console.error("Error loading customers:", error);
      } finally {
        setLoading(false);
      }
    };
    loadCustomers();
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    try {
      if (editingId) {
        const updated = { id: editingId, name: name.trim(), phone: phone.trim(), address: address.trim() };
        await updateCustomer(updated);
        setCustomers(customers.map((c) => (c.id === editingId ? updated : c)));
        setEditingId(null);
      } else {
        const customer = await addCustomer({ 
          name: name.trim(), 
          phone: phone.trim(), 
          address: address.trim() 
        });
        setCustomers([...customers, customer]);
      }
      setName("");
      setPhone("");
      setAddress("");
    } catch (error) {
      console.error("Error saving customer:", error);
    }
  };

  const handleEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setName(customer.name);
    setPhone(customer.phone);
    setAddress(customer.address);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Xác nhận xóa khách hàng này?")) {
      try {
        await deleteCustomer(id);
        setCustomers(customers.filter((c) => c.id !== id));
      } catch (error) {
        console.error("Error deleting customer:", error);
      }
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setAddress("");
  };

  const filteredCustomers = customers.filter((c) => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

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
      <h1 className="text-xl font-bold text-amber-500">Quản lý khách hàng</h1>

      {/* Add/Edit Form */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4 space-y-3">
          <Input
            placeholder="Tên khách hàng"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
          <Input
            placeholder="Số điện thoại"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
          <Input
            placeholder="Địa chỉ"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSubmit}
              disabled={!name.trim()}
              className="flex-1 bg-amber-600 hover:bg-amber-500"
            >
              {editingId ? "Cập nhật" : "Thêm khách hàng"}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={handleCancel}>
                Hủy
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Search */}
      <div className="relative">
        <Input
          placeholder="Tìm kiếm khách hàng..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-gray-900 border-gray-800 pl-10"
        />
        <svg className="absolute left-3 top-2.5 text-gray-500" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
      </div>

      {/* Customers List */}
      <div className="space-y-2">
        {filteredCustomers.map((customer) => (
          <Card key={customer.id} className={`bg-gray-900 border-gray-800 ${editingId === customer.id ? "border-amber-500" : ""}`}>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-white">{customer.name}</p>
                <p className="text-sm text-gray-400">{customer.phone}</p>
                {customer.address && <p className="text-xs text-gray-500 italic">{customer.address}</p>}
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleEdit(customer)}
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
                  onClick={() => handleDelete(customer.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredCustomers.length === 0 && (
          <p className="text-center text-gray-500 py-8">
            {searchQuery ? "Không tìm thấy khách hàng nào." : "Chưa có khách hàng nào."}
          </p>
        )}
      </div>
    </div>
  );
}
