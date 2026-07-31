"use client";

import { useState } from "react";
import { TestCompletionDialog } from "@/components/TestCompletionDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, CheckCircle, AlertCircle, Zap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { motion } from "framer-motion";

export function MyActiveTests() {
  const { isAuthenticated } = useAuth();
  const { data: profile } = trpc.profile.me.useQuery(undefined, { enabled: isAuthenticated });

  const activeEnrollments = profile?.enrollments?.filter(
    (e) => e.status === "enrolled" || e.status === "in_progress"
  ) || [];

  const [completionDialog, setCompletionDialog] = useState<{
    enrollmentId: number;
    testTitle: string;
  } | null>(null);

  const handleOpenCompletion = (enrollmentId: number, testTitle: string) => {
    setCompletionDialog({ enrollmentId, testTitle });
  };

  if (!isAuthenticated || activeEnrollments.length === 0) {
    return null;
  }

  return (
    <motion.div className="mb-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="font-display text-2xl font-bold mb-4">Your Active Tests</h2>
      <div className="grid md:grid-cols-2 gap-6">
        {activeEnrollments.map((enrollment) => (
          <Card key={enrollment.id} className="hover:border-primary/40 transition-colors">
            <CardHeader>
              <CardTitle className="text-lg">{enrollment.checklist ? "Test in Progress" : "Test Enrolled"}</CardTitle>
              <CardDescription>Test ID: {enrollment.testId}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant={enrollment.status === "in_progress" ? "default" : "outline"}>
                  {enrollment.status === "in_progress" ? "In Progress" : "Enrolled"}
                </Badge>
                {enrollment.status === "in_progress" && (
                  <CheckCircle className="w-4 h-4 text-green-500" />
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-foreground/60">
                <Clock className="w-4 h-4" />
                <span>Enrolled: {new Date(enrollment.enrolledAt).toLocaleDateString()}</span>
              </div>

              {enrollment.status === "enrolled" && (
                <Button
                  className="w-full gap-2"
                  onClick={() => handleOpenCompletion(enrollment.id, `Test #${enrollment.testId}`)}
                >
                  <Zap className="w-4 h-4" />
                  Start Test
                </Button>
              )}

              {enrollment.status === "in_progress" && (
                <Button
                  className="w-full gap-2"
                  variant="default"
                  onClick={() => handleOpenCompletion(enrollment.id, `Test #${enrollment.testId}`)}
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Test
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <TestCompletionDialog
        enrollmentId={completionDialog?.enrollmentId || 0}
        testTitle={completionDialog?.testTitle || ""}
        onComplete={() => {
          setCompletionDialog(null);
          window.location.reload();
        }}
      />
    </motion.div>
  );
}