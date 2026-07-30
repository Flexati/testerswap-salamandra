import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, BarChart3, Users, Zap, TrendingUp, Loader2, XCircle, CheckCircle, ShieldBan } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function AdminPanel() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect non-admin users
  if (user?.role !== "admin") {
    setLocation("/");
    return null;
  }

  // Admin stats query
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.admin.stats.useQuery();

  // Mutations
  const banUserMutation = trpc.admin.banUser.useMutation({
    onSuccess: () => {
      refetchStats();
    },
  });
  const resolveReportMutation = trpc.admin.resolveReport.useMutation({
    onSuccess: () => {
      // Could refetch reports list if we had one
    },
  });

  // State for dialogs
  const [banDialogOpen, setBanDialogOpen] = useState(false);
  const [banTarget, setBanTarget] = useState<{ userId: number; name: string } | null>(null);
  const [banReason, setBanReason] = useState("");
  const [reportActionDialogOpen, setReportActionDialogOpen] = useState(false);
  const [reportActionTarget, setReportActionTarget] = useState<{ reportId: number; action: "resolve" | "dismiss"; reporterName: string } | null>(null);
  const [reportActionTaken, setReportActionTaken] = useState("");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  const handleBanUser = (userId: number, name: string) => {
    setBanTarget({ userId, name });
    setBanReason("");
    setBanDialogOpen(true);
  };

  const confirmBan = () => {
    if (!banTarget || !banReason.trim()) return;
    banUserMutation.mutate({ targetUserId: banTarget.userId, reason: banReason.trim() });
    setBanDialogOpen(false);
    setBanTarget(null);
    setBanReason("");
  };

  const handleReportAction = (reportId: number, action: "resolve" | "dismiss", reporterName: string) => {
    setReportActionTarget({ reportId, action, reporterName });
    setReportActionTaken("");
    setReportActionDialogOpen(true);
  };

  const confirmReportAction = () => {
    if (!reportActionTarget) return;
    resolveReportMutation.mutate({
      reportId: reportActionTarget.reportId,
      action: reportActionTarget.action,
      actionTaken: reportActionTaken.trim() || undefined,
    });
    setReportActionDialogOpen(false);
    setReportActionTarget(null);
    setReportActionTaken("");
  };

  // Dummy user list for moderation tab - in a real app this would come from a users.list endpoint
  // For now we'll show the static list but with real ban functionality
  const mockUsers = [
    { id: 1, name: "John Doe", status: "active", reason: "" },
    { id: 2, name: "Jane Smith", status: "suspended", reason: "Spam reports" },
    { id: 3, name: "Bob Johnson", status: "active", reason: "" },
  ];

  // Dummy reports for reports tab - in a real app this would come from a reports.list endpoint
  const mockReports = [
    { id: 1, type: "User", reason: "Spam behavior", reporter: "User #123", status: "pending" },
    { id: 2, type: "App", reason: "Inappropriate content", reporter: "User #456", status: "resolved" },
    { id: 3, type: "Test", reason: "Fake test", reporter: "User #789", status: "pending" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-8">
      <div className="container mx-auto px-4">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-4xl font-bold mb-2 flex items-center gap-3">
            <BarChart3 className="w-8 h-8 text-primary" />
            Admin Panel
          </h1>
          <p className="text-foreground/70">Platform management and analytics</p>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-4 gap-6 mb-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground/70">Total Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statsLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /> : stats?.totalUsers ?? 1234}
                </div>
                <p className="text-xs text-foreground/60 mt-1">+12% from last month</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground/70">Active Tests</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statsLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /> : stats?.activeTests ?? 456}
                </div>
                <p className="text-xs text-foreground/60 mt-1">In progress</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground/70">DAU / MAU</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statsLoading
                    ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    : stats
                      ? `${stats.dau} / ${stats.mau} (${(stats.dauMauRatio * 100).toFixed(0)}%)`
                      : "523 / 1234 (42%)"}
                </div>
                <p className="text-xs text-foreground/60 mt-1">Daily / Monthly active</p>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div variants={itemVariants}>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-foreground/70">Retention (7d)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {statsLoading
                    ? <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                    : (() => {
                        const r7 = stats?.retention?.find(r => r.windowDays === 7);
                        return r7 ? `${Math.round(r7.retentionRate * 100)}%` : "55%";
                      })()}
                </div>
                <p className="text-xs text-foreground/60 mt-1">7-day retention</p>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>

        <Tabs defaultValue="moderation" className="mb-8">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="moderation">Moderation</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="moderation">
            <motion.div
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Card>
                <CardHeader>
                  <CardTitle>User Management</CardTitle>
                  <CardDescription>Ban or suspend users</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mockUsers.map((u) => (
                    <motion.div
                      key={u.id}
                      variants={itemVariants}
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{u.name}</p>
                        {u.reason && <p className="text-sm text-foreground/60">{u.reason}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={u.status === "active" ? "default" : "destructive"}>
                          {u.status}
                        </Badge>
                        {u.status === "active" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleBanUser(u.id, u.name)}
                            disabled={banUserMutation.isPending}
                          >
                            {banUserMutation.isPending && banTarget?.userId === u.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <ShieldBan className="w-4 h-4 mr-1" />
                            )}
                            Ban
                          </Button>
                        )}
                        {u.status === "suspended" && (
                          <Button size="sm" variant="outline" disabled>
                            Unban
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Banner Management</CardTitle>
                  <CardDescription>Add or edit promotional banners</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" disabled>+ Add Banner (Coming soon)</Button>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="reports">
            <motion.div
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Reported Content</CardTitle>
                  <CardDescription>Review and take action on reports</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mockReports.map((report) => (
                    <motion.div
                      key={report.id}
                      variants={itemVariants}
                      className="p-4 border border-border rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="w-4 h-4 text-destructive" />
                            <span className="font-medium">{report.type}</span>
                          </div>
                          <p className="text-sm text-foreground/70">{report.reason}</p>
                          <p className="text-xs text-foreground/50 mt-1">
                            Reported by: {report.reporter}
                          </p>
                        </div>
                        <Badge variant={report.status === "pending" ? "outline" : "secondary"}>
                          {report.status}
                        </Badge>
                      </div>
                      {report.status === "pending" && (
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReportAction(report.id, "dismiss", report.reporter)}
                            disabled={resolveReportMutation.isPending}
                          >
                            {resolveReportMutation.isPending && reportActionTarget?.reportId === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <XCircle className="w-4 h-4 mr-1" />
                            )}
                            Dismiss
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReportAction(report.id, "resolve", report.reporter)}
                            disabled={resolveReportMutation.isPending}
                          >
                            {resolveReportMutation.isPending && reportActionTarget?.reportId === report.id ? (
                              <Loader2 className="w-4 h-4 animate-spin mr-1" />
                            ) : (
                              <CheckCircle className="w-4 h-4 mr-1" />
                            )}
                            Resolve
                          </Button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          <TabsContent value="analytics">
            <motion.div
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <Card>
                <CardHeader>
                  <CardTitle>Platform Analytics</CardTitle>
                  <CardDescription>Key metrics and insights</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">DAU (Daily Active Users)</span>
                      <span className="text-2xl font-bold">{statsLoading ? "—" : stats?.dau ?? 523}</span>
                    </div>
                    <div className="w-full bg-secondary/20 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{ width: stats ? `${(stats.dau / Math.max(1, stats.mau)) * 100}%` : "65%" }}
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">MAU (Monthly Active Users)</span>
                      <span className="text-2xl font-bold">{statsLoading ? "—" : stats?.mau ?? 1234}</span>
                    </div>
                    <div className="w-full bg-secondary/20 rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: "75%" }} />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">DAU/MAU Ratio</span>
                      <span className="text-2xl font-bold">{stats ? `${(stats.dauMauRatio * 100).toFixed(0)}%` : "42%"}</span>
                    </div>
                    <div className="w-full bg-secondary/20 rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: stats ? `${stats.dauMauRatio * 100}%` : "42%" }} />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Active Tests</span>
                      <span className="text-2xl font-bold">{statsLoading ? "—" : stats?.activeTests ?? 456}</span>
                    </div>
                    <div className="w-full bg-secondary/20 rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: "78%" }} />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Retention 7-day</span>
                      <span className="text-2xl font-bold">
                        {(() => {
                          const r7 = stats?.retention?.find(r => r.windowDays === 7);
                          return r7 ? `${Math.round(r7.retentionRate * 100)}%` : "55%";
                        })()}
                      </span>
                    </div>
                    <div className="w-full bg-secondary/20 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width:
                            (() => {
                              const r7 = stats?.retention?.find(r => r.windowDays === 7);
                              return r7 ? `${r7.retentionRate * 100}%` : "55%";
                            })(),
                        }}
                      />
                    </div>
                  </motion.div>

                  <motion.div variants={itemVariants}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Retention 30-day</span>
                      <span className="text-2xl font-bold">
                        {(() => {
                          const r30 = stats?.retention?.find(r => r.windowDays === 30);
                          return r30 ? `${Math.round(r30.retentionRate * 100)}%` : "28%";
                        })()}
                      </span>
                    </div>
                    <div className="w-full bg-secondary/20 rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full"
                        style={{
                          width:
                            (() => {
                              const r30 = stats?.retention?.find(r => r.windowDays === 30);
                              return r30 ? `${r30.retentionRate * 100}%` : "28%";
                            })(),
                        }}
                      />
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Ban User Dialog */}
        <AlertDialog open={banDialogOpen} onOpenChange={setBanDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Ban User</AlertDialogTitle>
              <AlertDialogDescription>
                You are about to ban <strong>{banTarget?.name}</strong>. This action cannot be undone from this panel.
                Please provide a reason for the ban.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Reason for ban (required)"
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                maxLength={500}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmBan}
                disabled={banUserMutation.isPending || !banReason.trim()}
              >
                {banUserMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Banning...
                  </>
                ) : (
                  "Confirm Ban"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Report Action Dialog */}
        <AlertDialog open={reportActionDialogOpen} onOpenChange={setReportActionDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {reportActionTarget?.action === "resolve" ? "Resolve Report" : "Dismiss Report"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {reportActionTarget?.action === "resolve"
                  ? `Mark the report from <strong>${reportActionTarget?.reporterName}</strong> as resolved.`
                  : `Dismiss the report from <strong>${reportActionTarget?.reporterName}</strong> without action.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <Textarea
                placeholder="Action taken / notes (optional)"
                value={reportActionTaken}
                onChange={(e) => setReportActionTaken(e.target.value)}
                maxLength={500}
                rows={3}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmReportAction}
                disabled={resolveReportMutation.isPending}
              >
                {resolveReportMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    {reportActionTarget?.action === "resolve" ? "Resolving..." : "Dismissing..."}
                  </>
                ) : (
                  reportActionTarget?.action === "resolve" ? "Resolve" : "Dismiss"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
