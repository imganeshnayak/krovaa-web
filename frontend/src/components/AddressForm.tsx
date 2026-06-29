import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Pencil } from 'lucide-react';

export function AddressForm() {
  const { user, refreshUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
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
      
      // If no address is saved at all, default to edit mode
      if (!user.businessAddress && !user.businessCity && !user.businessState) {
        setIsEditing(true);
      } else {
        setIsEditing(false);
      }
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
      setIsEditing(false);

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

  if (!isEditing) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-white border rounded-lg shadow-sm">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium text-sm text-foreground">{user.businessAddress}</p>
                <p className="text-sm text-muted-foreground">
                  {user.businessCity && user.businessState ? `${user.businessCity}, ${user.businessState}` : user.businessCity || user.businessState}
                  {user.businessPincode && ` - ${user.businessPincode}`}
                </p>
                {user.businessLandmark && (
                  <p className="text-sm text-muted-foreground">Landmark: {user.businessLandmark}</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </div>
    );
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

      <div className="flex justify-end gap-2 pt-2">
        {(user.businessAddress || user.businessCity || user.businessState) && (
          <Button variant="outline" onClick={() => setIsEditing(false)}>
            Cancel
          </Button>
        )}
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
