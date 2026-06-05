import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserPreferences, updateUserPreferences, JobPreferences } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Bookmark } from 'lucide-react';

export function JobPreferencesForm() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<JobPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [jobTypesInput, setJobTypesInput] = useState('');
  const [locationsInput, setLocationsInput] = useState('');
  const { toast } = useToast();



  useEffect(() => {
    loadPreferences();
  }, [user?.id]);

  const loadPreferences = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const prefs = await getUserPreferences();
      setPreferences(prefs);

      // Populate input fields for editing
      setSkillsInput(prefs.skills.join(', '));
      setJobTypesInput(prefs.jobTypes.join(', '));
      setLocationsInput(prefs.locations.join(', '));
    } catch (err) {
      console.error('Failed to load preferences:', err);
      toast({
        title: 'Error',
        description: 'Failed to load your preferences',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!preferences) return;

    setSaving(true);
    try {
      // Parse comma-separated inputs into arrays
      const skills = skillsInput
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const jobTypes = jobTypesInput
        .split(',')
        .map((jt) => jt.trim())
        .filter((jt) => jt.length > 0);

      const locations = locationsInput
        .split(',')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      const updatedPreferences = await updateUserPreferences({
        skills,
        jobTypes,
        locations,
        remoteOnly: preferences.remoteOnly,
        minBudget: preferences.minBudget,
        maxBudget: preferences.maxBudget,
      });

      setPreferences(updatedPreferences);

      toast({
        title: 'Preferences saved',
        description: 'Your job preferences have been updated',
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
      toast({
        title: 'Error',
        description: 'Failed to save your preferences',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Job Preferences</CardTitle>
          <CardDescription>
            Set your job interests to get notified when matching jobs are posted
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-pulse rounded-xl bg-slate-200 p-6">
            <div className="space-y-3 text-center">
              <Bookmark className="w-6 h-6 mx-auto text-[#00A4EF]/50" />
              <h3 className="text-lg font-bold text-slate-900">Loading preferences...</h3>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!user) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Job Preferences</CardTitle>
          <CardDescription>
            Set your job interests to get notified when matching jobs are posted
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Bookmark className="w-6 h-6 mx-auto text-slate-400" />
            <p className="mt-2 text-sm text-slate-500">
              Please log in to set your job preferences
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Job Preferences</CardTitle>
        <CardDescription>
          Set your job interests to get notified when matching jobs are posted
        </CardDescription>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>Skills: e.g. React, Node.js, Design</span>
          <span>Job Types: e.g. Full-time, Remote, Contract</span>
          <span>Locations: e.g. New York, Remote, Bangalore</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Skills Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium mb-2">Skills</Label>
          <div className="flex items-center gap-2">
            <Input
              value={skillsInput}
              onChange={(e) => setSkillsInput(e.target.value)}
              placeholder="e.g. React, Node.js, UI/UX Design"
              className="flex-1"
            >
            </Input>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enter skills you're interested in, separated by commas
          </p>
        </div>

        {/* Job Types Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium mb-2">Job Types</Label>
          <div className="flex items-center gap-2">
            <Input
              value={jobTypesInput}
              onChange={(e) => setJobTypesInput(e.target.value)}
              placeholder="e.g. Full-time, Remote, Contract"
              className="flex-1"
            >
            </Input>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enter job types you're interested in, separated by commas
          </p>
        </div>

        {/* Locations Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium mb-2">Locations</Label>
          <div className="flex items-center gap-2">
            <Input
              value={locationsInput}
              onChange={(e) => setLocationsInput(e.target.value)}
              placeholder="e.g. New York, Remote, Bangalore"
              className="flex-1"
            >
            </Input>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enter locations you're interested in, separated by commas
          </p>
        </div>

        {/* Remote Only Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium mb-2">Remote Only</Label>
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={preferences?.remoteOnly ?? false}
              onCheckedChange={(checked) => {
                if (preferences) {
                  setPreferences({ ...preferences, remoteOnly: checked as boolean });
                }
              }}
            />
            <span className="text-sm text-slate-600">
              Only show remote jobs
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            If checked, you'll only be notified about remote jobs
          </p>
        </div>

        {/* Budget Range Section */}
        <div className="space-y-3">
          <Label className="text-sm font-medium mb-2">Budget Range (Optional)</Label>
          <div className="grid gap-4 grid-cols-[1fr_1fr]">
            <div className="space-y-2">
              <Label className="text-xs font-medium">Min Budget (₹)</Label>
              <Input
                type="number"
                min="0"
                value={preferences?.minBudget?.toString() ?? ''}
                onChange={(e) => {
                  if (preferences) {
                    const value = e.target.value;
                    setPreferences({
                      ...preferences,
                      minBudget: value === '' ? null : Number(value)
                    });
                  }
                }}
                placeholder="e.g. 5000"
                className="w-full"
              >
              </Input>
              <p className="text-xs text-slate-500">
                Minimum budget you're interested in
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium">Max Budget (₹)</Label>
              <Input
                type="number"
                min="0"
                value={preferences?.maxBudget?.toString() ?? ''}
                onChange={(e) => {
                  if (preferences) {
                    const value = e.target.value;
                    setPreferences({
                      ...preferences,
                      maxBudget: value === '' ? null : Number(value)
                    });
                  }
                }}
                placeholder="e.g. 50000"
                className="w-full"
              >
              </Input>
              <p className="text-xs text-slate-500">
                Maximum budget you're interested in
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-[200px]"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}