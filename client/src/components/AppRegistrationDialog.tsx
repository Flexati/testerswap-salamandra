"use client";

import { useState } from "react";
import { X, Zap, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const CATEGORIES = [
  "Utilities",
  "Productivity",
  "Games",
  "Social",
  "Education",
  "Health & Fitness",
  "Finance",
  "Entertainment",
  "Lifestyle",
  "Other",
];

const PLATFORMS = [
  { value: "android", label: "Android" },
  { value: "ios", label: "iOS" },
] as const;

interface AppRegistrationDialogProps {
  onSuccess?: () => void;
}

export function AppRegistrationDialog({ onSuccess }: AppRegistrationDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    appName: "",
    playStoreUrl: "",
    description: "",
    category: "",
    platform: "android",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createApp = trpc.apps.create.useMutation({
    onSuccess: () => {
      toast.success("App registered successfully!");
      setIsOpen(false);
      setFormData({ appName: "", playStoreUrl: "", description: "", category: "", platform: "android" });
      setErrors({});
      onSuccess?.();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to register app");
    },
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.appName.trim()) newErrors.appName = "App name is required";
    if (!formData.playStoreUrl.trim()) newErrors.playStoreUrl = "Play Store URL is required";
    else if (!formData.playStoreUrl.includes("play.google.com") && !formData.playStoreUrl.includes("apps.apple.com")) {
      newErrors.playStoreUrl = "Please provide a valid Play Store or App Store URL";
    }
    if (!formData.category) newErrors.category = "Category is required";
    if (!formData.platform) newErrors.platform = "Platform is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      createApp.mutate(formData);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2">
            <Zap className="w-4 h-4" />
            Register App
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register Your App</DialogTitle>
            <DialogDescription>
              Add your app to TesterSwap so testers can find it and help you reach 12 active testers.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appName">App Name</Label>
              <Input
                id="appName"
                placeholder="My Awesome App"
                value={formData.appName}
                onChange={(e) => handleChange("appName", e.target.value)}
                disabled={createApp.isPending}
                aria-invalid={!!errors.appName}
              />
              {errors.appName && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.appName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="playStoreUrl">Play Store / App Store URL</Label>
              <Input
                id="playStoreUrl"
                placeholder="https://play.google.com/store/apps/details?id=com.example.app"
                value={formData.playStoreUrl}
                onChange={(e) => handleChange("playStoreUrl", e.target.value)}
                disabled={createApp.isPending}
                aria-invalid={!!errors.playStoreUrl}
              />
              {errors.playStoreUrl && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.playStoreUrl}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Brief description of your app..."
                value={formData.description}
                onChange={(e) => handleChange("description", e.target.value)}
                disabled={createApp.isPending}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={formData.category} onValueChange={(v) => handleChange("category", v)} disabled={createApp.isPending}>
                <SelectTrigger id="category" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.category}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="platform">Platform</Label>
              <Select value={formData.platform} onValueChange={(v) => handleChange("platform", v)} disabled={createApp.isPending}>
                <SelectTrigger id="platform" aria-invalid={!!errors.platform}>
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.platform && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.platform}</p>}
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} disabled={createApp.isPending} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={createApp.isPending} className="flex-1">
                {createApp.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Registering...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Register
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}