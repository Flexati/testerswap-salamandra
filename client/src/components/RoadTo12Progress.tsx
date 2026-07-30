import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Clock, CheckCircle } from "lucide-react";
import { calculateProgress } from "@/lib/helpers";

interface RoadTo12ProgressProps {
  activeTesters: number;
  targetTesters?: number;
  daysRemaining: number;
  isCompleted?: boolean;
}

export default function RoadTo12Progress({
  activeTesters,
  targetTesters = 12,
  daysRemaining,
  isCompleted = false,
}: RoadTo12ProgressProps) {
  const progress = calculateProgress(activeTesters, targetTesters);
  const isAlmostThere = activeTesters >= 10;

  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Main progress card */}
      <div className="relative overflow-hidden rounded-lg border border-border bg-gradient-to-br from-primary/5 to-accent/5 p-8">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/10 rounded-full -mr-20 -mt-20" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-3xl font-bold">Road to {targetTesters}</h2>
            {isCompleted && (
              <Badge className="gap-2 bg-green-600 hover:bg-green-700">
                <CheckCircle className="w-4 h-4" />
                Completed
              </Badge>
            )}
          </div>

          <p className="text-foreground/70 mb-6">
            You're {activeTesters} steps away from reaching your goal!
          </p>

          {/* Progress visualization */}
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              {Array.from({ length: targetTesters }).map((_, i) => (
                <motion.div
                  key={i}
                  className={`flex-1 rounded-lg transition-all ${
                    i < activeTesters
                      ? "bg-primary h-16"
                      : "bg-secondary/30 h-8"
                  }`}
                  initial={{ height: 0 }}
                  animate={{
                    height: i < activeTesters ? 64 : 32,
                  }}
                  transition={{
                    delay: i * 0.05,
                    duration: 0.4,
                  }}
                />
              ))}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{activeTesters}</div>
                <div className="text-xs text-foreground/60">Active Testers</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-accent">{targetTesters - activeTesters}</div>
                <div className="text-xs text-foreground/60">Remaining</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-500">{progress}%</div>
                <div className="text-xs text-foreground/60">Complete</div>
              </div>
            </div>
          </div>

          {/* Status indicators */}
          <div className="grid md:grid-cols-2 gap-4 mt-8 pt-6 border-t border-border">
            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Trophy className={`w-5 h-5 ${isAlmostThere ? "text-yellow-500" : "text-foreground/40"}`} />
              <div>
                <div className="text-sm font-semibold">Almost There!</div>
                <div className="text-xs text-foreground/60">
                  {activeTesters >= 10 ? "You're in the final stretch!" : `${targetTesters - activeTesters} more to go`}
                </div>
              </div>
            </motion.div>

            <motion.div
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Clock className={`w-5 h-5 ${daysRemaining <= 3 ? "text-red-500" : "text-orange-500"}`} />
              <div>
                <div className="text-sm font-semibold">{daysRemaining} Days Left</div>
                <div className="text-xs text-foreground/60">
                  {daysRemaining <= 3 ? "Hurry up!" : "Time to recruit testers"}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Milestone badges */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { milestone: 3, label: "Getting Started" },
          { milestone: 6, label: "Halfway There" },
          { milestone: 9, label: "Almost Done" },
          { milestone: 12, label: "Legend" },
        ].map((item) => (
          <motion.div
            key={item.milestone}
            className={`p-3 rounded-lg text-center text-sm font-semibold transition-all ${
              activeTesters >= item.milestone
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/30 text-foreground/60"
            }`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: item.milestone * 0.05 }}
          >
            <div>{item.milestone}</div>
            <div className="text-xs">{item.label}</div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
