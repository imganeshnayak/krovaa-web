import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export function AddressForm() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [landmark, setLandmark] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setAddress(user.businessAddress || '');
      setCity(user.businessCity || user.city || '');
      setState(user.businessState || '');
      setPincode(user.businessPincode || user.pincode || '');
      setLandmark(user.businessLandmark || '');
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      await updateUserProfile(user.id, {
        businessAddress: address,
        businessCity: city,
        businessState: state,
        businessPincode: pincode,
        businessLandmark: landmark
      });

      await refreshUser();

      toast({
        title: 'Address saved',
        description: 'Your delivery address has been updated',
      });
    } catch (err) {
      console.error('Failed to save address:', err);
      toast({
        title: 'Error',
        description: 'Failed to save your address',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Street Address</Label>
        <Input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter your street address"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">City</Label>
          <Input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Enter city"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">State</Label>
          <Input
            value={state}
            onChange={(e) => setState(e.target.value)}
            placeholder="Enter state"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Pincode</Label>
          <Input
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="Enter 6-digit pincode"
            maxLength={6}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Landmark (Optional)</Label>
          <Input
            value={landmark}
            onChange={(e) => setLandmark(e.target.value)}
            placeholder="Near a known place"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-[200px]"
        >
          {saving ? 'Saving...' : 'Save Address'}
        </Button>
      </div>
    </div>
  );
}
