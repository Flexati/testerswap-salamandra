import { useAuth } from "@/_core/hooks/useAuth";
import { AppRegistrationDialog } from "@/components/AppRegistrationDialog";
import { MyActiveTests } from "@/components/MyActiveTests";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Loader2, Zap, Trophy, TrendingUp, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user, logout, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { data: profile, isLoading: profileLoading } = trpc.profile.me.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );
  const { data: credits, isLoading: creditsLoading } = trpc.profile.credits.useQuery(
    undefined,
    { enabled: isAuthenticated }
  );

  if (!isAuthenticated) {
    setLocation("/");
    return null;
  }

  if (profileLoading || creditsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const roadTo12Progress = profile?.activeTests?.[0]?.currentTesters || 0;
  const progressPercent = (roadTo12Progress / 12) * 100;

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
      transition: { duration: 0.4 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <nav className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-primary">TesterSwap</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-foreground/70">{user?.name}</span>
            <Button size="sm" variant="outline" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <motion.div
        className="container mx-auto px-4 py-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Road to 12 Section */}
        <motion.div variants={itemVariants} className="mb-8">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-display">Road to 12</CardTitle>
                  <CardDescription>Your progress towards 12 active testers</CardDescription>
                </div>
                <Trophy className="w-8 h-8 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Active Testers</span>
                  <span className="text-2xl font-bold text-primary">{roadTo12Progress}/12</span>
                </div>
                <Progress value={progressPercent} className="h-3" />
              </div>

              <div className="grid grid-cols-3 gap-4 pt-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">{credits || 0}</div>
                  <div className="text-sm text-foreground/60">Credits</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">14</div>
                  <div className="text-sm text-foreground/60">Days Left</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {Math.round(progressPercent)}%
                  </div>
                  <div className="text-sm text-foreground/60">Complete</div>
                </div>
              </div>

              <Button className="w-full mt-4 gap-2">
                <Zap className="w-4 h-4" />
                Find Testers
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground/70">
                Tests Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.enrollments?.length || 0}</div>
              <p className="text-xs text-foreground/60 mt-1">as a tester</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground/70">
                Trust Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.trustScore || 50}/100</div>
              <p className="text-xs text-foreground/60 mt-1">reliability rating</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-foreground/70">
                Apps Registered
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.apps?.length || 0}</div>
              <p className="text-xs text-foreground/60 mt-1">waiting for testers</p>
            </CardContent>
          </Card>
        </motion.div>

        {/* My Active Tests Section */}
        <MyActiveTests />

        {/* Apps Section */}
        {profile?.apps && profile.apps.length > 0 && (
          <motion.div variants={itemVariants} className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-2xl font-bold">Your Apps</h2>
              <AppRegistrationDialog onSuccess={() => window.location.reload()} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              {profile.apps.map((app) => (
                <Card key={app.id} className="hover:border-primary/40 transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">{app.appName}</CardTitle>
                    <CardDescription>{app.category}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-foreground/70">{app.description}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline">{app.platform}</Badge>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                    <Button variant="outline" className="w-full">
                      View Details
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty State */}
        {(!profile?.apps || profile.apps.length === 0) && (
          <motion.div variants={itemVariants} className="text-center py-12">
            <TrendingUp className="w-12 h-12 text-foreground/30 mx-auto mb-4" />
            <h3 className="font-display text-xl font-bold mb-2">No apps yet</h3>
            <p className="text-foreground/60 mb-6">Register your first app to get started</p>
            <AppRegistrationDialog onSuccess={() => window.location.reload()} />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
