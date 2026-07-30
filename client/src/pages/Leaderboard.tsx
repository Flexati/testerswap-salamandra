import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Loader2, Trophy, Zap, Award, Star } from "lucide-react";
import { motion } from "framer-motion";

export default function Leaderboard() {
  const { data: leaderboard = [], isLoading } = trpc.leaderboard.top.useQuery();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.3 },
    },
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />;
    if (rank === 2) return <Trophy className="w-5 h-5 text-gray-400" />;
    if (rank === 3) return <Trophy className="w-5 h-5 text-orange-600" />;
    return <span className="text-sm font-bold text-foreground/60">#{rank}</span>;
  };

  const getBadgeIcon = (badgeType: string) => {
    switch (badgeType) {
      case "gold":
        return <Star className="w-4 h-4 text-yellow-500" />;
      case "silver":
        return <Star className="w-4 h-4 text-gray-400" />;
      case "bronze":
        return <Star className="w-4 h-4 text-orange-600" />;
      default:
        return <Award className="w-4 h-4 text-primary" />;
    }
  };

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
            <Trophy className="w-8 h-8 text-primary" />
            Leaderboard
          </h1>
          <p className="text-foreground/70">Top testers and their achievements</p>
        </motion.div>

        <Tabs defaultValue="testers" className="mb-8">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="testers">Top Testers</TabsTrigger>
            <TabsTrigger value="badges">Badges</TabsTrigger>
          </TabsList>

          <TabsContent value="testers">
            <motion.div
              className="space-y-4"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {leaderboard && leaderboard.length > 0 ? (
                leaderboard.map((tester: any, index: number) => (
                  <motion.div key={tester.userId} variants={itemVariants}>
                    <Card className="hover:border-primary/40 transition-colors">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                            {getRankBadge(index + 1)}
                          </div>

                          <div className="flex-1">
                            <h3 className="font-semibold text-lg">{tester.userName}</h3>
                            <p className="text-sm text-foreground/60">
                              {tester.completedTests} tests completed
                            </p>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-1 mb-2">
                              <Zap className="w-4 h-4 text-primary" />
                              <span className="font-bold text-lg">{tester.creditsEarned}</span>
                            </div>
                            <div className="text-sm text-foreground/60">
                              Trust: {tester.trustScore}/100
                            </div>
                          </div>
                        </div>

                        {tester.badges && tester.badges.length > 0 && (
                          <div className="flex gap-2 mt-4 flex-wrap">
                            {tester.badges?.map((badge: string) => (
                              <Badge key={badge} variant="secondary" className="gap-1">
                                {getBadgeIcon(badge)}
                                {badge}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              ) : (
                <motion.div
                  className="text-center py-12"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.4 }}
                >
                  <p className="text-foreground/60">No testers yet</p>
                </motion.div>
              )}
            </motion.div>
          </TabsContent>

          <TabsContent value="badges">
            <motion.div
              className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {[
                {
                  name: "First Test",
                  description: "Complete your first test",
                  icon: "🎯",
                  rarity: "common",
                },
                {
                  name: "Speed Runner",
                  description: "Complete 5 tests in one week",
                  icon: "⚡",
                  rarity: "rare",
                },
                {
                  name: "Trusted Tester",
                  description: "Reach 80+ trust score",
                  icon: "🛡️",
                  rarity: "rare",
                },
                {
                  name: "Credit Master",
                  description: "Earn 500+ credits",
                  icon: "💎",
                  rarity: "epic",
                },
                {
                  name: "Perfect Record",
                  description: "100% completion rate on 10 tests",
                  icon: "⭐",
                  rarity: "epic",
                },
                {
                  name: "Legend",
                  description: "Reach rank #1 on leaderboard",
                  icon: "👑",
                  rarity: "legendary",
                },
              ].map((badge) => (
                <motion.div key={badge.name} variants={itemVariants}>
                  <Card className="hover:border-primary/40 transition-colors h-full">
                    <CardHeader>
                      <div className="text-4xl mb-2">{badge.icon}</div>
                      <CardTitle className="text-lg">{badge.name}</CardTitle>
                      <CardDescription>{badge.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className="capitalize">
                        {badge.rarity}
                      </Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
