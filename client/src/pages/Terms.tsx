import { motion } from "framer-motion";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="font-display text-4xl font-bold mb-2">Terms of Service</h1>
          <p className="text-foreground/70">Last updated: July 29, 2026</p>
        </motion.div>

        <motion.div
          className="prose prose-invert max-w-none space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <section className="space-y-3">
            <h2 className="text-2xl font-bold">1. Agreement to Terms</h2>
            <p className="text-foreground/80">
              By accessing and using TesterSwap Salamandra, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">2. Use License</h2>
            <p className="text-foreground/80">
              Permission is granted to temporarily download one copy of the materials (information or software) on TesterSwap Salamandra for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80">
              <li>Modifying or copying the materials</li>
              <li>Using the materials for any commercial purpose or for any public display</li>
              <li>Attempting to decompile or reverse engineer any software contained on TesterSwap Salamandra</li>
              <li>Removing any copyright or other proprietary notations from the materials</li>
              <li>Transferring the materials to another person or "mirroring" the materials on any other server</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">3. Disclaimer</h2>
            <p className="text-foreground/80">
              The materials on TesterSwap Salamandra are provided on an 'as is' basis. TesterSwap Salamandra makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">4. Limitations</h2>
            <p className="text-foreground/80">
              In no event shall TesterSwap Salamandra or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on TesterSwap Salamandra.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">5. Accuracy of Materials</h2>
            <p className="text-foreground/80">
              The materials appearing on TesterSwap Salamandra could include technical, typographical, or photographic errors. TesterSwap Salamandra does not warrant that any of the materials on its website are accurate, complete, or current. TesterSwap Salamandra may make changes to the materials contained on its website at any time without notice.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">6. Modifications</h2>
            <p className="text-foreground/80">
              TesterSwap Salamandra may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">7. Governing Law</h2>
            <p className="text-foreground/80">
              These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which TesterSwap Salamandra operates, and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">8. Contact Information</h2>
            <p className="text-foreground/80">
              If you have any questions about these Terms of Service, please contact us at:
            </p>
            <p className="text-foreground/80">
              Email: support@testerswap.com<br />
              Website: https://testerswap.manus.space
            </p>
          </section>
        </motion.div>
      </div>
    </div>
  );
}
