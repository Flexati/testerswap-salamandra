import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  subtitle?: string;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  color?: "primary" | "success" | "warning" | "danger";
}

const colorMap = {
  primary: "text-primary bg-primary/10",
  success: "text-green-600 bg-green-100",
  warning: "text-yellow-600 bg-yellow-100",
  danger: "text-red-600 bg-red-100",
};

export default function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  trend,
  trendValue,
  color = "primary",
}: StatCardProps) {
  const trendColor =
    trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-gray-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="hover:border-primary/40 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-foreground/70">
              {title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${colorMap[color]}`}>
              <Icon className="w-4 h-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{value}</div>
          {subtitle && <p className="text-xs text-foreground/60 mt-1">{subtitle}</p>}
          {trendValue && (
            <p className={`text-xs font-semibold mt-2 ${trendColor}`}>
              {trend === "up" && "↑"} {trend === "down" && "↓"} {trendValue}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
