import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2, Search, Zap, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export default function Marketplace() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const { data: tests, isLoading } = trpc.tests.list.useQuery();

  // Enrollment mutation
  const enrollMutation = trpc.enrollments.create.useMutation();

  // Dialog state
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollTarget, setEnrollTarget] = useState<{ testId: number; title: string; credits: number } | null>(null);

  const handleEnrollClick = (testId: number, title: string, credits: number) => {
    setEnrollTarget({ testId, title, credits });
    setEnrollDialogOpen(true);
  };

  const confirmEnroll = () => {
    if (!enrollTarget) return;
    enrollMutation.mutate({ testId: enrollTarget.testId });
    setEnrollDialogOpen(false);
    setEnrollTarget(null);
  };

  const filteredTests = tests?.filter((test) => {
    const matchesSearch =
      searchQuery === "" ||
      test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      test.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory = selectedCategory === null;
    const matchesCountry = selectedCountry === null || test.country === selectedCountry;

    return matchesSearch && matchesCategory && matchesCountry;
  });

  const countries = Array.from(new Set(tests?.map((t) => t.country).filter(Boolean)));

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
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3 },
    },
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-8">
      <div className="container mx-auto px-4">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-display text-4xl font-bold mb-2">Marketplace</h1>
          <p className="text-foreground/70">Find apps to test and earn credits</p>
        </motion.div>

        <motion.div
          className="mb-8 space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-foreground/40" />
            <Input
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {countries.map((country) => (
              <Button
                key={country}
                variant={selectedCountry === country ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCountry(selectedCountry === country ? null : country)}
              >
                {country}
              </Button>
            ))}
          </div>
        </motion.div>

        <motion.div
          className="grid md:grid-cols-2 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {filteredTests && filteredTests.length > 0 ? (
            filteredTests.map((test) => {
              const daysLeft = Math.ceil(
                (new Date(test.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
              );
              const spotsLeft = test.targetTesters - test.currentTesters;

              return (
                <motion.div key={test.id} variants={itemVariants}>
                  <Card className="hover:border-primary/40 transition-colors h-full flex flex-col">
                    <CardHeader>
                      <CardTitle className="text-lg">{test.title}</CardTitle>
                      <CardDescription>Android Test</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-4">
                      <p className="text-sm text-foreground/70">{test.description}</p>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground/60">Testers Needed</span>
                          <span className="font-bold text-primary">
                            {spotsLeft}/{test.targetTesters}
                          </span>
                        </div>
                        <div className="w-full bg-secondary/20 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{
                              width: `${((test.currentTesters / test.targetTesters) * 100).toFixed(0)}%`,
                            }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-sm text-foreground/60">
                        <Clock className="w-4 h-4" />
                        <span>{daysLeft} days left</span>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <Badge variant="outline">Android</Badge>
                        {test.country && <Badge variant="secondary">{test.country}</Badge>}
                      </div>

                      <Button
                        className="w-full gap-2 mt-4"
                        onClick={() => handleEnrollClick(test.id, test.title, test.creditsPerTester)}
                        disabled={enrollMutation.isPending || spotsLeft <= 0}
                      >
                        <Zap className="w-4 h-4" />
                        {enrollMutation.isPending && enrollTarget?.testId === test.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Enrolling...
                          </>
                        ) : spotsLeft <= 0 ? (
                          "Full"
                        ) : (
                          `Enroll (${test.creditsPerTester} credits)`
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          ) : (
            <motion.div
              className="col-span-full text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
            >
              <p className="text-foreground/60">No tests found matching your criteria</p>
            </motion.div>
          )}
        </motion.div>

        {/* Enrollment Confirmation Dialog */}
        <EnrollConfirmDialog
          open={enrollDialogOpen}
          onOpenChange={setEnrollDialogOpen}
          test={enrollTarget}
          onConfirm={confirmEnroll}
          isPending={enrollMutation.isPending}
        />
      </div>
    </div>
  );
}

// Enrollment Confirmation Dialog
function EnrollConfirmDialog({
  open,
  onOpenChange,
  test,
  onConfirm,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  test: { testId: number; title: string; credits: number } | null;
  onConfirm: () => void;
  isPending: boolean;
}) {
  if (!test) return null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Enroll in Test</AlertDialogTitle>
          <AlertDialogDescription>
            You are about to enroll in <strong>{test.title}</strong>.
            This will reserve <strong>{test.credits} credits</strong> from your balance.
            Once enrolled, you must complete the test within the campaign period.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Enrolling...
              </>
            ) : (
              "Confirm Enrollment"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
