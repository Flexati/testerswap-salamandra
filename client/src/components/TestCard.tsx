import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Users, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { getDaysRemaining, calculateProgress, getStatusBadgeVariant } from "@/lib/helpers";

interface TestCardProps {
  id: number;
  appName: string;
  category?: string;
  description: string;
  activeTesters: number;
  targetTesters: number;
  creditsReward: number;
  daysRemaining: number;
  status: "active" | "completed" | "expired" | "pending";
  onAction?: () => void;
  actionLabel?: string;
  showProgress?: boolean;
}

export default function TestCard({
  id,
  appName,
  category,
  description,
  activeTesters,
  targetTesters,
  creditsReward,
  daysRemaining,
  status,
  onAction,
  actionLabel = "Enroll",
  showProgress = true,
}: TestCardProps) {
  const progress = calculateProgress(activeTesters, targetTesters);
  const isCompleted = status === "completed";
  const isExpired = status === "expired";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:border-primary/40 transition-all hover:shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <CardTitle className="text-lg">{appName}</CardTitle>
              {category && (
                <CardDescription className="text-xs mt-1">{category}</CardDescription>
              )}
            </div>
            <Badge variant={getStatusBadgeVariant(status)} className="capitalize">
              {status}
            </Badge>
          </div>
          <CardDescription className="line-clamp-2">{description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Progress bar */}
          {showProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground/70">Testers</span>
                <span className="font-semibold">
                  {activeTesters}/{targetTesters}
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span className="text-foreground/70">{activeTesters} active</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-orange-500" />
              <span className="text-foreground/70">{daysRemaining}d left</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <span className="font-semibold">{creditsReward}</span>
            </div>
          </div>

          {/* Action button */}
          {onAction && !isCompleted && !isExpired && (
            <Button
              onClick={onAction}
              variant="default"
              className="w-full"
              disabled={isExpired}
            >
              {actionLabel}
            </Button>
          )}

          {isCompleted && (
            <Button disabled className="w-full">
              ✓ Completed
            </Button>
          )}

          {isExpired && (
            <Button disabled variant="destructive" className="w-full">
              ✗ Expired
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
