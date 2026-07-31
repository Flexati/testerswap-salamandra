"use client";

import { useState } from "react";
import { X, Loader2, Check, Camera, Image, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface TestCompletionDialogProps {
  enrollmentId: number;
  testTitle: string;
  onComplete: () => void;
}

export function TestCompletionDialog({ enrollmentId, testTitle, onComplete }: TestCompletionDialogProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [checklist, setChecklist] = useState({
    installed: false,
    opened: false,
    minutesUsed: 0,
    minMinutes: 5,
    feedbackSubmitted: false,
  });
  const [feedbackText, setFeedbackText] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const verifyCompletion = trpc.enrollments.verifyCompletion.useMutation({
    onSuccess: (result) => {
      if (result.status === "verified") {
        toast.success(`Test completed! You earned ${result.creditsAwarded} credits.`);
      } else {
        toast.error("Checklist incomplete. Please complete all required steps.");
      }
      setIsOpen(false);
      onComplete();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to submit completion");
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrors((prev) => ({ ...prev, screenshot: "Please select an image file" }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, screenshot: "File size must be less than 5MB" }));
        return;
      }
      setErrors((prev) => ({ ...prev, screenshot: "" }));
      setScreenshotFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setScreenshotPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleChecklistChange = (field: keyof typeof checklist, value: boolean | number) => {
    setChecklist((prev) => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!checklist.installed) newErrors.installed = "You must confirm app installation";
    if (!checklist.opened) newErrors.opened = "You must confirm app was opened";
    if (checklist.minutesUsed < checklist.minMinutes) {
      newErrors.minutesUsed = `Minimum ${checklist.minMinutes} minutes required`;
    }
    if (!checklist.feedbackSubmitted) newErrors.feedbackSubmitted = "Feedback submission is required";
    if (!feedbackText.trim()) newErrors.feedbackText = "Feedback text is required";
    if (checklist.minutesUsed < 0) newErrors.minutesUsed = "Minutes cannot be negative";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      const screenshotBase64 = screenshotPreview?.split(",")[1] || "";
      verifyCompletion.mutate({
        enrollmentId,
        checklist,
        hasScreenshot: !!screenshotFile,
        feedbackText,
        screenshotBase64,
        screenshotMimeType: screenshotFile?.type || "image/jpeg",
      });
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Complete Test: {testTitle}</DialogTitle>
          <DialogDescription>
            Please complete all checklist items, upload a screenshot, and provide feedback to earn credits.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Checklist</CardTitle>
              <CardDescription>Confirm you have completed each step</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="installed"
                  checked={checklist.installed}
                  onCheckedChange={(v) => handleChecklistChange("installed", v)}
                  disabled={verifyCompletion.isPending}
                />
                <Label htmlFor="installed" className="cursor-pointer flex-1">
                  I have installed the app
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="opened"
                  checked={checklist.opened}
                  onCheckedChange={(v) => handleChecklistChange("opened", v)}
                  disabled={verifyCompletion.isPending}
                />
                <Label htmlFor="opened" className="cursor-pointer flex-1">
                  I have opened and used the app
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="minutesUsed">Minutes Used</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="minutesUsed"
                    type="number"
                    min={0}
                    value={checklist.minutesUsed}
                    onChange={(e) => handleChecklistChange("minutesUsed", parseInt(e.target.value) || 0)}
                    disabled={verifyCompletion.isPending}
                    className="w-24 px-3 py-2 border border-input rounded-md bg-background"
                  />
                  <span className="text-sm text-foreground/60">min (minimum: {checklist.minMinutes})</span>
                </div>
                {errors.minutesUsed && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.minutesUsed}</p>}
              </div>
              <div className="flex items-center gap-3">
                <Checkbox
                  id="feedbackSubmitted"
                  checked={checklist.feedbackSubmitted}
                  onCheckedChange={(v) => handleChecklistChange("feedbackSubmitted", v)}
                  disabled={verifyCompletion.isPending}
                />
                <Label htmlFor="feedbackSubmitted" className="cursor-pointer flex-1">
                  I have submitted feedback
                </Label>
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Screenshot (Optional but Recommended)</CardTitle>
              <CardDescription>Upload a screenshot showing the app running on your device</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                {screenshotPreview ? (
                  <div className="relative max-w-xs mx-auto">
                    <img src={screenshotPreview} alt="Screenshot preview" className="rounded-lg max-h-48" />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-destructive hover:bg-destructive/10"
                      onClick={() => {
                        setScreenshotFile(null);
                        setScreenshotPreview(null);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                    <p className="text-sm text-foreground/60 mt-2">Screenshot attached</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Camera className="w-12 h-12 text-foreground/30 mx-auto" />
                    <p className="text-foreground/60">Click or drag to upload screenshot</p>
                    <p className="text-xs text-foreground/40">PNG, JPG up to 5MB</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      disabled={verifyCompletion.isPending}
                      className="hidden"
                      id="screenshot-upload"
                    />
                    <Button type="button" variant="outline" onClick={() => document.getElementById("screenshot-upload")?.click()}>
                      Choose File
                    </Button>
                  </div>
                )}
                {errors.screenshot && <p className="text-sm text-destructive flex items-center gap-1 justify-center"><AlertCircle className="w-3 h-3" />{errors.screenshot}</p>}
              </div>
            </CardContent>
          </Card>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle>Feedback</CardTitle>
              <CardDescription>Share your experience with the app (required)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                placeholder="What did you like? What could be improved? Any bugs encountered?"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                disabled={verifyCompletion.isPending}
                rows={4}
                aria-invalid={!!errors.feedbackText}
              />
              {errors.feedbackText && <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="w-3 h-3" />{errors.feedbackText}</p>}
            </CardContent>
          </Card>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={verifyCompletion.isPending} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={verifyCompletion.isPending} className="flex-1">
              {verifyCompletion.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Submit Completion
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}