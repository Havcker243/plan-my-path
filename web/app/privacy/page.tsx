import Link from "next/link";
import { GraduationCap, ArrowLeft, Shield } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — GradPath",
  description: "Learn how GradPath collects, uses, and protects your personal information.",
};

const sections = [
  {
    number: "01",
    title: "Information We Collect",
    content:
      "We collect information you provide directly when creating an account or using GradPath, including your name, email address, major, graduation year, GPA, and academic plan data. We also collect limited usage data — such as pages visited and features used — to improve the service. We do not collect sensitive personal data beyond what is necessary to operate GradPath, and we never collect financial information.",
  },
  {
    number: "02",
    title: "How We Use Your Information",
    content:
      "Your information is used solely to provide and personalize your GradPath experience: generating your academic plan, tracking degree progress, and sending account-related communications such as password resets. We do not sell your personal data to third parties or use it for targeted advertising. Aggregate, anonymized usage data may be used internally to improve features and course data quality.",
  },
  {
    number: "03",
    title: "Data Storage & Security",
    content:
      "Your account and plan data is stored securely in our database hosted on Supabase, with encryption at rest and in transit using industry-standard TLS. We take reasonable technical and organizational measures to protect your data from unauthorized access, loss, or disclosure. You may request deletion of your account and all associated data at any time by contacting us.",
  },
  {
    number: "04",
    title: "Cookies",
    content:
      "GradPath uses cookies and similar technologies solely to maintain your authenticated session and remember your preferences across visits. We do not use tracking cookies for advertising or cross-site tracking purposes. You can configure your browser to refuse cookies, but some features of the service — including staying logged in — may not function correctly without them.",
  },
  {
    number: "05",
    title: "Third-Party Services",
    content:
      "We use Supabase for authentication and database storage. Supabase processes your data on our behalf in accordance with their privacy policy and data processing agreements. Your data is stored in US-based data centers and is subject to Supabase's security and compliance standards. We do not use third-party analytics platforms, advertising networks, or data brokers.",
  },
  {
    number: "06",
    title: "Data Retention",
    content:
      "We retain your account and plan data for as long as your account is active or as needed to provide the service. If you delete your account, we will remove your personal data within 30 days, except where we are required to retain it for legal or compliance reasons. Anonymized, aggregate usage data may be retained indefinitely as it cannot be linked back to you.",
  },
  {
    number: "07",
    title: "Your Rights",
    content:
      "You have the right to access, correct, export, or delete the personal data we hold about you. You may also object to certain processing activities or request that we restrict how we use your data. To exercise any of these rights, contact us at the address below. We will respond within 30 days and will not charge a fee for reasonable requests.",
  },
  {
    number: "08",
    title: "Children's Privacy",
    content:
      "GradPath is intended for use by college and university students and is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will take steps to delete it promptly. If you believe a minor has submitted data, please contact us immediately.",
  },
  {
    number: "09",
    title: "Contact",
    content: null,
    isContact: true,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">GradPath</span>
        </Link>
        <Link
          href="/"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to home
        </Link>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-14">
        {/* Header */}
        <div className="flex items-start gap-4 mb-10 pb-10 border-b border-border">
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mt-1">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Privacy Policy</h1>
            <p className="text-sm text-muted-foreground">
              Last updated: <span className="font-medium text-foreground">April 4, 2026</span>
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-lg">
              Your privacy matters to us. This policy explains what data we collect, why we collect it, and how you can control it.
            </p>
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {sections.map((section) =>
            section.isContact ? (
              <section key={section.number}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-mono font-semibold text-primary">{section.number}</span>
                  <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  If you have questions about this Privacy Policy or how we handle your data, please contact us at{" "}
                  <a
                    href="mailto:privacy@gradpath.app"
                    className="text-primary hover:underline font-medium"
                  >
                    privacy@gradpath.app
                  </a>
                  . We take privacy seriously and aim to respond to all inquiries within two business days. You can also reach us by mail at GradPath, Inc., United States.
                </p>
              </section>
            ) : (
              <section key={section.number}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-[11px] font-mono font-semibold text-primary">{section.number}</span>
                  <h2 className="text-base font-semibold text-foreground">{section.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
              </section>
            )
          )}
        </div>

        {/* Bottom note */}
        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-xs text-muted-foreground">
            This policy was last reviewed and updated on April 4, 2026. If you have a disability and need this policy in an alternative format, please contact{" "}
            <a href="mailto:privacy@gradpath.app" className="text-primary hover:underline">
              privacy@gradpath.app
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-border py-6 px-6 md:px-12 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>GradPath &copy; 2026</span>
        </div>
        <div className="flex gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link>
        </div>
      </footer>
    </div>
  );
}
