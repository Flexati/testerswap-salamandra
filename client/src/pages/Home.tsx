import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Zap, Shield, TrendingUp, Users } from "lucide-react";
import { useLocation } from "wouter";
import { startLogin } from "@/const";
import { motion } from "framer-motion";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  const handleGetStarted = () => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    } else {
      startLogin();
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
        duration: 0.6,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6 },
    },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/manus-storage/testerswap_logo.png" alt="TesterSwap" className="w-8 h-8" />
            <span className="font-display text-xl font-bold text-primary">TesterSwap</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <span className="text-sm text-foreground/70">Welcome, {user?.name}</span>
                <Button onClick={() => setLocation("/dashboard")} variant="default">
                  Dashboard
                </Button>
                <Button onClick={() => setLocation("/marketplace")} variant="outline">
                  Marketplace
                </Button>
                <Button onClick={() => setLocation("/leaderboard")} variant="outline">
                  Leaderboard
                </Button>
              </>
            ) : (
              <Button onClick={handleGetStarted} variant="default">
                Get Started
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <motion.section
        className="pt-32 pb-20 px-4"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div variants={itemVariants} className="mb-6">
            <img
              src="/manus-storage/testerswap_logo.png"
              alt="TesterSwap Salamandra"
              className="w-24 h-24 mx-auto mb-6"
            />
          </motion.div>

          <motion.h1
            variants={itemVariants}
            className="font-display text-5xl md:text-6xl font-bold text-foreground mb-4 leading-tight"
          >
            Swap, Don't Pay
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-xl text-foreground/70 mb-8 max-w-2xl mx-auto"
          >
            The free tester exchange platform for Android developers. Reach your 12 testers goal
            through reciprocal testing. No payments, just fair swaps.
          </motion.p>

          <motion.div variants={itemVariants} className="flex gap-4 justify-center flex-wrap">
            <Button size="lg" onClick={handleGetStarted} className="gap-2">
              Start Testing <ArrowRight className="w-4 h-4" />
            </Button>
            <Button size="lg" variant="outline">
              Learn More
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section
        className="py-20 px-4 bg-card/50"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <div className="container mx-auto max-w-5xl">
          <motion.h2
            variants={itemVariants}
            className="font-display text-4xl font-bold text-center mb-16 text-foreground"
          >
            Why TesterSwap?
          </motion.h2>

          <div className="grid md:grid-cols-2 gap-8">
            <motion.div variants={itemVariants}>
              <Card className="border-primary/20 hover:border-primary/40 transition-colors h-full">
                <CardHeader>
                  <Zap className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Zero Cost</CardTitle>
                  <CardDescription>No payments, no hidden fees. Pure exchange.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70">
                    Earn credits by testing apps and spend them to get testers for your own app.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-primary/20 hover:border-primary/40 transition-colors h-full">
                <CardHeader>
                  <Shield className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Trust System</CardTitle>
                  <CardDescription>Reliable testers with verified completion rates.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70">
                    Our trust score system ensures quality testers and fair exchanges.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-primary/20 hover:border-primary/40 transition-colors h-full">
                <CardHeader>
                  <TrendingUp className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Road to 12</CardTitle>
                  <CardDescription>Visual progress tracking for your testing goal.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70">
                    Watch your progress as you reach the 12 testers required by Google Play.
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="border-primary/20 hover:border-primary/40 transition-colors h-full">
                <CardHeader>
                  <Users className="w-8 h-8 text-primary mb-2" />
                  <CardTitle>Community</CardTitle>
                  <CardDescription>Join thousands of developers helping each other.</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-foreground/70">
                    Gamification, badges, and leaderboards to celebrate your testing journey.
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* How It Works */}
      <motion.section
        className="py-20 px-4"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <div className="container mx-auto max-w-4xl">
          <motion.h2
            variants={itemVariants}
            className="font-display text-4xl font-bold text-center mb-16 text-foreground"
          >
            How It Works
          </motion.h2>

          <div className="space-y-8">
            {[
              {
                step: "1",
                title: "Register Your App",
                description: "Add your app details and Play Store link to get started.",
              },
              {
                step: "2",
                title: "Earn Credits",
                description: "Test other apps and earn credits for each verified test.",
              },
              {
                step: "3",
                title: "Find Testers",
                description: "Spend credits to enroll testers for your own app.",
              },
              {
                step: "4",
                title: "Reach Your Goal",
                description: "Get 12 testers and complete your 14-day testing period.",
              },
            ].map((item, idx) => (
              <motion.div
                key={idx}
                variants={itemVariants}
                className="flex gap-6 items-start"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-bold text-lg">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-display text-xl font-bold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-foreground/70">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section
        className="py-20 px-4 bg-gradient-to-r from-primary/10 to-primary/5"
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
      >
        <div className="container mx-auto max-w-2xl text-center">
          <motion.h2
            variants={itemVariants}
            className="font-display text-4xl font-bold mb-6 text-foreground"
          >
            Ready to Get Started?
          </motion.h2>

          <motion.p variants={itemVariants} className="text-lg text-foreground/70 mb-8">
            Join the community of developers swapping tests and reaching their goals together.
          </motion.p>

          <motion.div variants={itemVariants}>
            <Button size="lg" onClick={handleGetStarted} className="gap-2">
              Join TesterSwap <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container mx-auto text-center text-foreground/60 text-sm">
          <p>&copy; 2026 TesterSwap. Swap, don't pay.</p>
        </div>
      </footer>
    </div>
  );
}
