import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Home, Phone, MapPin, CheckCircle2, Pencil } from "lucide-react";
import { OrderAddress, apiFetch, createOrderAddress, updateOrderAddress } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface AddressSelectionUIProps {
  dealId?: number;
  onAddressSelected: (address: OrderAddress) => void;
  selectedAddressId?: number | null;
}

export function AddressSelectionUI({ dealId, onAddressSelected, selectedAddressId }: AddressSelectionUIProps) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<OrderAddress[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Form State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  
  const [addrFullName, setAddrFullName] = useState("");
  const [addrPhone, setAddrPhone] = useState("");
  const [addrLine1, setAddrLine1] = useState("");
  const [addrLine2, setAddrLine2] = useState("");
  const [addrLandmark, setAddrLandmark] = useState("");
  const [addrCity, setAddrCity] = useState("");
  const [addrState, setAddrState] = useState("");
  const [addrPincode, setAddrPincode] = useState("");
  const [addrType, setAddrType] = useState("home");

  const loadAddresses = async () => {
    try {
      const data = await apiFetch<OrderAddress[]>('/api/order-addresses');
      setAddresses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAddresses();
    if (user) {
      setAddrFullName(user.displayName || "");
      setAddrPhone(user.phoneNumber || "");
      setAddrCity(user.city || "");
      setAddrPincode(user.pincode || "");
    }
  }, [user]);

  const resetForm = () => {
    setEditingAddressId(null);
    if (user) {
      setAddrFullName(user.displayName || "");
      setAddrPhone(user.phoneNumber || "");
      setAddrCity(user.city || "");
      setAddrPincode(user.pincode || "");
    } else {
      setAddrFullName("");
      setAddrPhone("");
      setAddrCity("");
      setAddrPincode("");
    }
    setAddrLine1("");
    setAddrLine2("");
    setAddrLandmark("");
    setAddrState("");
    setAddrType("home");
  };

  const handleOpenEdit = (addr: OrderAddress, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingAddressId(addr.id);
    setAddrFullName(addr.fullName);
    setAddrPhone(addr.phoneNumber);
    setAddrLine1(addr.addressLine1);
    setAddrLine2(addr.addressLine2 || "");
    setAddrLandmark(addr.landmark || "");
    setAddrCity(addr.city);
    setAddrState(addr.state);
    setAddrPincode(addr.pincode);
    setAddrType(addr.addressType);
    setIsDialogOpen(true);
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const handleSaveAddress = async () => {
    const errors: string[] = [];
    if (!addrFullName.trim() || addrFullName.trim().length < 3) errors.push('Enter full name (min 3 chars)');
    if (!addrLine1.trim() || addrLine1.trim().length < 10) errors.push('Street address must be at least 10 characters');
    if (!addrCity.trim()) errors.push('City is required');
    if (!addrState) errors.push('Select your state');
    if (!/^\d{6}$/.test(addrPincode)) errors.push('Pincode must be 6 digits');
    if (!/^[6-9]\d{9}$/.test(addrPhone)) errors.push('Enter a valid 10-digit mobile number');
    
    if (errors.length > 0) {
      toast.error(errors[0]);
      return;
    }

    setIsSaving(true);
    try {
      let savedAddr;
      
      const payload = {
        fullName: addrFullName.trim(),
        phoneNumber: addrPhone.trim(),
        addressType: addrType,
        addressLine1: addrLine1.trim(),
        addressLine2: addrLine2.trim() || undefined,
        landmark: addrLandmark.trim() || undefined,
        city: addrCity.trim(),
        state: addrState,
        pincode: addrPincode.trim(),
        isDefault: true,
        checkPincodeServiceability: false
      };

      if (editingAddressId) {
        savedAddr = await updateOrderAddress(editingAddressId, payload);
        toast.success('Address updated!');
      } else {
        savedAddr = await createOrderAddress(payload);
        toast.success('Address saved!');
      }
      
      setIsDialogOpen(false);
      await loadAddresses();
      
      // Select the newly added or updated address if none is selected, or if we just edited the currently selected one
      if (!selectedAddressId || selectedAddressId === editingAddressId) {
        onAddressSelected(savedAddr);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save address.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="h-20 animate-pulse bg-slate-100 rounded-xl"></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery Address</h4>
        {addresses.length > 0 && (
          <Button variant="link" size="sm" onClick={handleOpenAdd} className="h-auto p-0 text-[#00A4EF] text-xs">
            + Add New
          </Button>
        )}
      </div>

      {addresses.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center space-y-3">
          <MapPin className="h-8 w-8 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-600">You need to add a delivery address to proceed.</p>
          <Button onClick={handleOpenAdd} className="bg-slate-900 text-white rounded-xl text-xs px-6">
            Add Address
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {addresses.map(addr => (
            <div 
              key={addr.id} 
              onClick={() => onAddressSelected(addr)}
              className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex gap-3 ${
                selectedAddressId === addr.id 
                  ? 'border-[#00A4EF] bg-sky-50 dark:bg-sky-950/20' 
                  : 'border-slate-200 hover:border-slate-300 dark:border-slate-800'
              }`}
            >
              <div className="pt-1 text-[#00A4EF]">
                {selectedAddressId === addr.id ? <CheckCircle2 className="h-5 w-5" /> : <div className="h-5 w-5 rounded-full border-2 border-slate-300" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{addr.fullName}</span>
                    <span className="text-[10px] font-bold uppercase bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{addr.addressType}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0 text-slate-400 hover:text-[#00A4EF]" 
                    onClick={(e) => handleOpenEdit(addr, e)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1">{addr.addressLine1}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{addr.city}, {addr.state} - {addr.pincode}</p>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1"><Phone className="h-3 w-3" /> {addr.phoneNumber}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Address Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md bg-white rounded-3xl border-0 shadow-2xl p-6 max-h-[90vh] overflow-y-auto" onInteractOutside={e => e.preventDefault()}>
          <DialogTitle className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Home className="h-5 w-5 text-[#00A4EF]" />
            {editingAddressId ? "Edit Delivery Address" : "Enter Delivery Address"}
          </DialogTitle>
          <p className="text-xs text-slate-500 mt-1">
            Required for courier dispatch. Your address is only shared with Krovaa's shipping partner.
          </p>

          <div className="space-y-3.5 py-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Full Name *</Label>
              <Input value={addrFullName} onChange={e => setAddrFullName(e.target.value)} placeholder="As printed on Aadhaar / ID" className="h-10 text-xs" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mobile Number *</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input type="tel" maxLength={10} value={addrPhone} onChange={e => setAddrPhone(e.target.value.replace(/\D/g, ""))} placeholder="10-digit number" className="h-10 pl-9 text-xs font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Street Address *</Label>
              <Textarea value={addrLine1} onChange={e => setAddrLine1(e.target.value)} placeholder="House/Flat no., Building name, Street name" rows={2} className="text-xs resize-none" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Landmark (Optional)</Label>
              <Input value={addrLandmark} onChange={e => setAddrLandmark(e.target.value)} placeholder="Near school / temple" className="h-10 text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">City *</Label>
                <Input value={addrCity} onChange={e => setAddrCity(e.target.value)} placeholder="e.g. Mumbai" className="h-10 text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Pincode *</Label>
                <Input type="text" maxLength={6} value={addrPincode} onChange={e => setAddrPincode(e.target.value.replace(/\D/g, ""))} placeholder="6-digit" className="h-10 text-xs font-mono" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">State *</Label>
              <select value={addrState} onChange={e => setAddrState(e.target.value)} className="w-full h-10 px-3 bg-white border border-slate-200 rounded-md text-xs outline-none focus:ring-2 focus:ring-[#00A4EF] text-slate-700">
                <option value="">Select State</option>
                {[
                  ['AN','Andaman & Nicobar Islands'], ['AP','Andhra Pradesh'], ['AR','Arunachal Pradesh'],
                  ['AS','Assam'], ['BR','Bihar'], ['CG','Chhattisgarh'], ['CH','Chandigarh'],
                  ['DD','Daman & Diu'], ['DL','Delhi'], ['DN','Dadra & Nagar Haveli'],
                  ['GA','Goa'], ['GJ','Gujarat'], ['HR','Haryana'], ['HP','Himachal Pradesh'],
                  ['JK','Jammu & Kashmir'], ['JH','Jharkhand'], ['KA','Karnataka'],
                  ['KL','Kerala'], ['LA','Ladakh'], ['LD','Lakshadweep'], ['MH','Maharashtra'],
                  ['ML','Meghalaya'], ['MN','Manipur'], ['ME','Meghalaya'], ['MZ','Mizoram'],
                  ['NL','Nagaland'], ['OD','Odisha'], ['PB','Punjab'], ['PY','Puducherry'],
                  ['RJ','Rajasthan'], ['SK','Sikkim'], ['TN','Tamil Nadu'], ['TR','Tripura'],
                  ['TS','Telangana'], ['UP','Uttar Pradesh'], ['UK','Uttarakhand'], ['WB','West Bengal']
                ].map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setIsDialogOpen(false)} className="h-10 text-xs font-semibold">Cancel</Button>
            <Button size="sm" onClick={handleSaveAddress} disabled={isSaving} className="h-10 text-xs font-bold bg-[#00A4EF] hover:bg-[#0087d1] text-white">
              {isSaving ? "Saving..." : "Save Address"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
