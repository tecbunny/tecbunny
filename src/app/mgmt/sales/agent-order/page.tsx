"use client";

import * as React from 'react'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { useToast } from '../../../../hooks/use-toast'
import { createClient } from '@/lib/supabase/client'
import type { Product, CartItem } from '@/lib/types'

export default function AgentOrderPage() {
  const supabase = createClient()
  const { toast } = useToast()
  const [email, setEmail] = React.useState('')
  const [mobile, setMobile] = React.useState('')
  const [name, setName] = React.useState('')
  const [customerId, setCustomerId] = React.useState<string | null>(null)
  const [products, setProducts] = React.useState<Product[]>([])
  const [cart, setCart] = React.useState<CartItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [lastOrderId, setLastOrderId] = React.useState<string | null>(null)
  const [lastOrderAmount, setLastOrderAmount] = React.useState<number | null>(null)
  const [customerProfile, setCustomerProfile] = React.useState<{ name?: string | null; email?: string | null; mobile?: string | null; gstin?: string | null } | null>(null)

  React.useEffect(() => {
    supabase.from('products').select('*').then(({ data, error }) => {
      if (error) {
        toast({ variant: 'destructive', title: 'Unable to load products', description: error.message })
        return
      }
      const normalized = (data || []).map((product) => ({
        ...product,
        name: product?.name || product?.title || product?.model_number || 'Unnamed Product',
        price: Number(product?.price ?? product?.offer_price ?? product?.mrp ?? 0),
      }))
      setProducts(normalized)
    })
  }, [supabase, toast])

  const findCustomer = async () => {
    if (!email && !mobile) {
      toast({ variant: 'destructive', title: 'Provide email or mobile to lookup' })
      return
    }
    setLoading(true)
    try {
      let query = supabase.from('profiles').select('id,name,email,mobile,gstin').limit(1)
      if (email) {
        query = query.eq('email', email)
      } else if (mobile) {
        query = query.eq('mobile', mobile)
      }
      const { data, error } = await query.maybeSingle()
      if (error && error.code !== 'PGRST116') {
        throw error
      }
      if (data) {
        setCustomerId(data.id)
        setCustomerProfile(data)
        setName(data.name ?? '')
        setEmail(data.email ?? email)
        setMobile(data.mobile ?? mobile)
        toast({ title: 'Customer found', description: 'Using existing profile' })
      } else {
        setCustomerId(null)
        setCustomerProfile(null)
        toast({ title: 'No customer found', description: 'New account will be created on submit' })
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Lookup failed', description: error.message })
    } finally {
      setLoading(false)
    }
  }

  const addToCart = (p: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { ...p, quantity: 1 }]
    })
  }

  const submitOrder = async () => {
    if (!email && !mobile) {
      toast({ variant: 'destructive', title: 'Provide customer email or mobile' })
      return
    }
    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Cart is empty' })
      return
    }
    setLoading(true)
    try {
      const items = cart.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price, name: i.name }))
      const res = await fetch('/api/agents/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer: { email, mobile, name }, items })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed')
      // Compute amount client-side for immediate payment step
      const amount = cart.reduce((acc, i) => acc + i.price * i.quantity, 0)
      setLastOrderId(json.order_id)
      setLastOrderAmount(amount)
      toast({ title: 'Order created', description: `Order ID: ${json.order_id}` })
      setCart([])
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message })
    } finally {
      setLoading(false)
    }
  }

  const initiatePhonePe = async () => {
    if (!lastOrderId || !lastOrderAmount) return
    setLoading(true)
    try {
      const res = await fetch('/api/payment/phonepe/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: lastOrderId, amount: lastOrderAmount, customerPhone: mobile || undefined, customerEmail: email || undefined })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.message || json?.error || 'Payment init failed')
      const url = json?.data?.paymentUrl || json?.paymentUrl
      if (url) {
        window.open(url, '_blank', 'noopener')
        toast({ title: 'Payment link opened' })
      } else {
        toast({ variant: 'destructive', title: 'Payment URL missing' })
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Payment error', description: e.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle>Customer</CardTitle>
            <CardDescription>Lookup by email or mobile; new account auto-creates on submit.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Customer name (optional)" value={name} onChange={e => setName(e.target.value)} />
            <Input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
            <Input placeholder="Mobile" value={mobile} onChange={e => setMobile(e.target.value)} />
            <Button disabled={loading} onClick={findCustomer}>Find</Button>
            {customerId && <p className="text-sm text-muted-foreground">Resolved profile: {customerId}</p>}
            {customerProfile && (
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p><span className="font-semibold">Name:</span> {customerProfile.name || 'N/A'}</p>
                <p><span className="font-semibold">Email:</span> {customerProfile.email || 'N/A'}</p>
                <p><span className="font-semibold">Mobile:</span> {customerProfile.mobile || 'N/A'}</p>
                {customerProfile.gstin && <p><span className="font-semibold">GSTIN:</span> {customerProfile.gstin}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>Add products to cart</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 max-h-[420px] overflow-auto">
            {products.map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 border-b last:border-b-0">
                <div>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-sm text-muted-foreground">₹{Number(p.price ?? 0).toFixed(2)}</div>
                </div>
                <Button size="sm" onClick={() => addToCart(p)}>Add</Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cart</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {cart.length === 0 && <div className="text-sm text-muted-foreground">No items</div>}
            {cart.map(i => (
              <div key={i.id} className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">{i.name}</div>
                  <div className="text-sm text-muted-foreground">Qty: {i.quantity} • ₹{Number(i.price ?? 0).toFixed(2)}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setCart(prev => prev.map(x => x.id === i.id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))}>-</Button>
                  <Button size="sm" variant="secondary" onClick={() => setCart(prev => prev.map(x => x.id === i.id ? { ...x, quantity: x.quantity + 1 } : x))}>+</Button>
                  <Button size="sm" variant="destructive" onClick={() => setCart(prev => prev.filter(x => x.id !== i.id))}>Remove</Button>
                </div>
              </div>
            ))}
            <div className="pt-2">
              <Button disabled={loading} onClick={submitOrder}>Submit Order</Button>
              {lastOrderId && lastOrderAmount ? (
                <Button variant="secondary" className="ml-2" disabled={loading} onClick={initiatePhonePe}>
                  Initiate PhonePe Payment
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
