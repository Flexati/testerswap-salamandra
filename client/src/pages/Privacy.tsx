import { motion } from "framer-motion";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="font-display text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-foreground/70">Last updated: July 29, 2026</p>
        </motion.div>

        <motion.div
          className="prose prose-invert max-w-none space-y-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <section className="space-y-3">
            <h2 className="text-2xl font-bold">1. Introduction</h2>
            <p className="text-foreground/80">
              TesterSwap Salamandra ("we", "us", "our", or "Company") operates the TesterSwap Salamandra website and mobile application (the "Service"). This page informs you of our policies regarding the collection, use, and disclosure of personal data when you use our Service and the choices you have associated with that data.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">2. Information Collection and Use</h2>
            <p className="text-foreground/80">
              We collect several different types of information for various purposes to provide and improve our Service to you.
            </p>
            <div className="space-y-2 ml-4">
              <p><strong>Account Information:</strong> When you create an account, we collect your name, email address, and app information.</p>
              <p><strong>Usage Data:</strong> We automatically collect information about how you interact with our Service, including IP address, browser type, pages visited, and time spent.</p>
              <p><strong>Device Information:</strong> We collect information about your device, including device type, operating system, and unique device identifiers.</p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">3. Use of Data</h2>
            <p className="text-foreground/80">
              TesterSwap Salamandra uses the collected data for various purposes:
            </p>
            <ul className="list-disc list-inside space-y-2 text-foreground/80">
              <li>To provide and maintain our Service</li>
              <li>To notify you about changes to our Service</li>
              <li>To allow you to participate in interactive features of our Service</li>
              <li>To provide customer support</li>
              <li>To gather analysis or valuable information to improve our Service</li>
              <li>To monitor the usage of our Service</li>
              <li>To detect, prevent and address technical issues</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">4. Security of Data</h2>
            <p className="text-foreground/80">
              The security of your data is important to us but remember that no method of transmission over the Internet or method of electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">5. Changes to This Privacy Policy</h2>
            <p className="text-foreground/80">
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date at the top of this Privacy Policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-2xl font-bold">6. Contact Us</h2>
            <p className="text-foreground/80">
              If you have any questions about this Privacy Policy, please contact us at:
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
