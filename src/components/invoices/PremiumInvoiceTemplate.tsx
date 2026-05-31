'use client';

import React, { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface InvoiceItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

interface InvoiceData {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  companyGST: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  clientCompany: string;
  clientContact: string;
  clientAddress: string;
  clientEmail: string;
  paymentMethod: string;
  paymentTerms: string;
  items: InvoiceItem[];
  taxRate: number;
  discount: number;
  notes: string;
}

export default function PremiumInvoiceTemplate() {
  const [invoiceData, setInvoiceData] = useState<InvoiceData>({
    companyName: 'TecBunny Solutions',
    companyAddress: 'H NO 11 NHAYGINWADA, PARSE, Parxem, Pernem, North Goa- 403512, Goa',
    companyPhone: '+91 96041 36010',
    companyEmail: 'support@tecbunny.com',
    companyGST: '30AAMCT1608G1ZO',
    invoiceNumber: 'INV-2025-001',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    clientCompany: '',
    clientContact: '',
    clientAddress: '',
    clientEmail: '',
    paymentMethod: 'Bank Transfer',
    paymentTerms: 'Net 30',
    items: [
      { description: 'Web Development Services', quantity: 40, rate: 75.00, amount: 3000.00 },
      { description: 'UI/UX Design', quantity: 20, rate: 85.00, amount: 1700.00 }
    ],
    taxRate: 18, // GST rate for India
    discount: 0,
    notes: `Thank you for your business! Payment is due within 30 days of invoice date. Please include invoice number with payment.

Bank Details:
Account Name: TecBunny Solutions
Account Number: 1234567890
IFSC Code: SBIN0001234
GST Number: 30AAMCT1608G1ZO

For any questions regarding this invoice, please contact our billing department.`
  });

  const calculateTotals = () => {
    const subtotal = invoiceData.items.reduce((sum, item) => sum + item.amount, 0);
    const discountAmount = invoiceData.discount;
    const taxableAmount = subtotal - discountAmount;
    const taxAmount = taxableAmount * (invoiceData.taxRate / 100);
    const total = taxableAmount + taxAmount;

    return {
      subtotal: subtotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      total: total.toFixed(2)
    };
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const newItems = [...invoiceData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'rate') {
      newItems[index].amount = newItems[index].quantity * newItems[index].rate;
    }
    
    setInvoiceData({ ...invoiceData, items: newItems });
  };

  const addItem = () => {
    setInvoiceData({
      ...invoiceData,
      items: [...invoiceData.items, { description: '', quantity: 1, rate: 0, amount: 0 }]
    });
  };

  const removeItem = (index: number) => {
    const newItems = invoiceData.items.filter((_, i) => i !== index);
    setInvoiceData({ ...invoiceData, items: newItems });
  };

  const printInvoice = () => {
    window.print();
  };

  const clearInvoice = () => {
    if (confirm('Are you sure you want to clear all invoice data?')) {
      setInvoiceData({
        ...invoiceData,
        invoiceNumber: 'INV-2025-001',
        clientCompany: '',
        clientContact: '',
        clientAddress: '',
        clientEmail: '',
        items: [{ description: '', quantity: 1, rate: 0, amount: 0 }],
        discount: 0,
        notes: ''
      });
    }
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-blue-800 py-12">
      {/* Floating Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-white bg-opacity-10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-24 h-24 bg-purple-300 bg-opacity-20 rounded-full blur-lg animate-bounce"></div>
        <div className="absolute bottom-32 left-1/4 w-40 h-40 bg-indigo-300 bg-opacity-15 rounded-full blur-2xl animate-pulse"></div>
      </div>

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        {/* Action Buttons */}
        <div className="no-print mb-8 flex flex-wrap gap-4 justify-center">
          <Button onClick={printInvoice} className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
            🖨️ Print Invoice
          </Button>
          <Button onClick={clearInvoice} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700">
            🗑️ Clear All
          </Button>
          <Button className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
            💾 Save Template
          </Button>
        </div>

        {/* Invoice Container */}
        <div className="bg-white bg-opacity-95 backdrop-blur-lg rounded-3xl shadow-2xl p-10 relative overflow-hidden">
          {/* Decorative Elements */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-full opacity-10 blur-3xl"></div>
          
          {/* Header */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            {/* Company Info */}
            <div>
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center mr-4 shadow-lg">
                  <span className="text-white font-bold text-xl">TB</span>
                </div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-transparent mb-1">
                    {invoiceData.companyName}
                  </h1>
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                    Premium Business
                  </div>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-gray-50 to-indigo-50 p-6 rounded-2xl border border-indigo-100">
                <div className="space-y-3 text-gray-700">
                  <div className="flex items-center">
                    <span className="w-5 h-5 mr-3 text-indigo-500">📍</span>
                    <span>{invoiceData.companyAddress}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-5 h-5 mr-3 text-indigo-500">📞</span>
                    <span>{invoiceData.companyPhone}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-5 h-5 mr-3 text-indigo-500">✉️</span>
                    <span>{invoiceData.companyEmail}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-5 h-5 mr-3 text-indigo-500">🏛️</span>
                    <span>GST: {invoiceData.companyGST}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Invoice Details */}
            <div className="text-right">
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-8 rounded-3xl text-white shadow-2xl">
                <h2 className="text-5xl font-black mb-6 tracking-tight">INVOICE</h2>
                <div className="space-y-4">
                  <div className="bg-white bg-opacity-20 rounded-xl p-4">
                    <div className="text-sm opacity-80 mb-1">Invoice Number</div>
                    <div className="text-2xl font-bold text-amber-300">
                      <Input
                        value={invoiceData.invoiceNumber}
                        onChange={(e) => setInvoiceData({...invoiceData, invoiceNumber: e.target.value})}
                        className="bg-transparent border-2 border-white border-opacity-30 text-white text-center font-bold text-xl"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white bg-opacity-20 rounded-xl p-4">
                      <div className="text-sm opacity-80 mb-2">Issue Date</div>
                      <Input
                        type="date"
                        value={invoiceData.invoiceDate}
                        onChange={(e) => setInvoiceData({...invoiceData, invoiceDate: e.target.value})}
                        className="bg-transparent border-2 border-white border-opacity-30 text-white"
                      />
                    </div>
                    <div className="bg-white bg-opacity-20 rounded-xl p-4">
                      <div className="text-sm opacity-80 mb-2">Due Date</div>
                      <Input
                        type="date"
                        value={invoiceData.dueDate}
                        onChange={(e) => setInvoiceData({...invoiceData, dueDate: e.target.value})}
                        className="bg-transparent border-2 border-white border-opacity-30 text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bill To Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
            <div>
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mr-3">
                  <span className="text-white">👤</span>
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-700 bg-clip-text text-transparent">Bill To</h3>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-2xl border border-blue-200">
                <div className="space-y-3">
                  <Input
                    placeholder="Client Company Name"
                    value={invoiceData.clientCompany}
                    onChange={(e) => setInvoiceData({...invoiceData, clientCompany: e.target.value})}
                    className="font-bold text-xl border-2 border-blue-200 focus:border-blue-500"
                  />
                  <Input
                    placeholder="Contact Person"
                    value={invoiceData.clientContact}
                    onChange={(e) => setInvoiceData({...invoiceData, clientContact: e.target.value})}
                    className="border-2 border-blue-200 focus:border-blue-500"
                  />
                  <Input
                    placeholder="Street Address"
                    value={invoiceData.clientAddress}
                    onChange={(e) => setInvoiceData({...invoiceData, clientAddress: e.target.value})}
                    className="border-2 border-blue-200 focus:border-blue-500"
                  />
                  <Input
                    placeholder="Email Address"
                    value={invoiceData.clientEmail}
                    onChange={(e) => setInvoiceData({...invoiceData, clientEmail: e.target.value})}
                    className="border-2 border-blue-200 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
            
            <div>
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mr-3">
                  <span className="text-white">💳</span>
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-700 bg-clip-text text-transparent">Payment Terms</h3>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-2xl border border-green-200">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">Payment Method:</span>
                    <Select value={invoiceData.paymentMethod} onValueChange={(value) => setInvoiceData({...invoiceData, paymentMethod: value})}>
                      <SelectTrigger className="w-40 border-2 border-green-200 focus:border-green-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                        <SelectItem value="Credit Card">Credit Card</SelectItem>
                        <SelectItem value="Check">Check</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700">Terms:</span>
                    <Select value={invoiceData.paymentTerms} onValueChange={(value) => setInvoiceData({...invoiceData, paymentTerms: value})}>
                      <SelectTrigger className="w-40 border-2 border-green-200 focus:border-green-500">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Net 30">Net 30</SelectItem>
                        <SelectItem value="Net 15">Net 15</SelectItem>
                        <SelectItem value="Due on Receipt">Due on Receipt</SelectItem>
                        <SelectItem value="Net 60">Net 60</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center mr-3">
                  <span className="text-white">📋</span>
                </div>
                <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-700 bg-clip-text text-transparent">Invoice Items</h3>
              </div>
              <Button onClick={addItem} className="no-print bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
                ➕ Add Item
              </Button>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white">
                      <th className="px-6 py-4 text-left font-semibold">Description</th>
                      <th className="px-6 py-4 text-center font-semibold">Qty</th>
                      <th className="px-6 py-4 text-right font-semibold">Rate (₹)</th>
                      <th className="px-6 py-4 text-right font-semibold">Amount (₹)</th>
                      <th className="px-6 py-4 text-center font-semibold no-print">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.items.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gradient-to-r hover:from-gray-50 hover:to-indigo-50 transition-all">
                        <td className="px-6 py-4">
                          <Input
                            placeholder="Item description"
                            value={item.description}
                            onChange={(e) => updateItem(index, 'description', e.target.value)}
                            className="border-none bg-transparent font-medium"
                          />
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-16 text-center border border-gray-200 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.rate}
                            onChange={(e) => updateItem(index, 'rate', parseFloat(e.target.value) || 0)}
                            className="w-24 text-right border border-gray-200 focus:border-indigo-500"
                          />
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-lg text-indigo-600">
                          ₹{item.amount.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center no-print">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="w-8 h-8 p-0 bg-red-100 hover:bg-red-200 text-red-600"
                          >
                            🗑️
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Totals Section */}
          <div className="flex justify-end mb-10">
            <div className="w-96">
              <div className="bg-gradient-to-br from-gray-50 to-indigo-50 rounded-2xl p-8 shadow-xl border border-indigo-100">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                    <span className="text-white text-sm">🧮</span>
                  </div>
                  <h3 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-700 bg-clip-text text-transparent">Invoice Summary</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-3 border-b border-indigo-100">
                    <span className="text-gray-700 font-medium">Subtotal:</span>
                    <span className="font-bold text-lg text-gray-900">₹{totals.subtotal}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b border-indigo-100">
                    <span className="text-gray-700 font-medium">GST Rate:</span>
                    <div className="flex items-center">
                      <Input
                        type="number"
                        step="0.1"
                        value={invoiceData.taxRate}
                        onChange={(e) => setInvoiceData({...invoiceData, taxRate: parseFloat(e.target.value) || 0})}
                        className="w-16 text-right border-2 border-indigo-200 focus:border-indigo-500"
                      />
                      <span className="ml-1 text-indigo-600 font-semibold">%</span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b border-indigo-100">
                    <span className="text-gray-700 font-medium">GST Amount:</span>
                    <span className="font-bold text-lg text-orange-600">₹{totals.taxAmount}</span>
                  </div>
                  
                  <div className="flex justify-between items-center py-3 border-b border-indigo-100">
                    <span className="text-gray-700 font-medium">Discount:</span>
                    <div className="flex items-center">
                      <span className="text-gray-500 mr-1">₹</span>
                      <Input
                        type="number"
                        step="0.01"
                        value={invoiceData.discount}
                        onChange={(e) => setInvoiceData({...invoiceData, discount: parseFloat(e.target.value) || 0})}
                        className="w-20 text-right border-2 border-indigo-200 focus:border-indigo-500"
                      />
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-indigo-600 to-purple-700 rounded-xl p-6 text-white shadow-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-xl font-bold">Total Amount:</span>
                      <span className="text-3xl font-black">₹{totals.total}</span>
                    </div>
                    <div className="text-indigo-200 text-sm mt-2">Amount due within payment terms</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="mb-10">
            <div className="flex items-center mb-4">
              <div className="w-10 h-10 bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl flex items-center justify-center mr-3">
                <span className="text-white">📝</span>
              </div>
              <h3 className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-orange-700 bg-clip-text text-transparent">Additional Notes</h3>
            </div>
            <div className="bg-gradient-to-br from-amber-50 to-orange-100 rounded-2xl p-6 border border-amber-200">
              <Textarea
                value={invoiceData.notes}
                onChange={(e) => setInvoiceData({...invoiceData, notes: e.target.value})}
                placeholder="Additional notes, payment instructions, or terms..."
                className="w-full h-32 border-2 border-amber-200 focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="relative">
            <div className="bg-gradient-to-r from-gray-50 to-indigo-50 rounded-2xl p-8 border border-indigo-100 text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="w-12 h-12 bg-gradient-to-r from-indigo-600 to-purple-700 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white">✅</span>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">Invoice Generated Successfully</p>
                  <p className="text-sm text-gray-600">Generated on <span className="font-semibold text-indigo-600">{new Date().toLocaleDateString()}</span></p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-indigo-100">
                <p className="text-gray-700 font-medium">For questions about this invoice, please contact us using the information above.</p>
                <p className="text-sm text-gray-500 mt-2">This is a computer-generated invoice and is valid without signature.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .bg-gradient-to-br { background: white !important; }
        }
      `}</style>
    </div>
  );
}