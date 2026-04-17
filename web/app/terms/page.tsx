import Link from "next/link";
import { GraduationCap, ArrowLeft, FileText } from "lucide-react";

export const metadata = {
  title: "Terms of Service — FiskGrad",
  description: "Read FiskGrad's Terms of Service to understand how you may use the platform.",
};

const sections = [
  {
    number: "01",
    title: "Acceptance of Terms",
    content:
      "By accessing or using FiskGrad, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using this service. We reserve the right to update these terms at any time, and your continued use of the service after changes are posted constitutes your acceptance of those changes.",
  },
  {
    number: "02",
    title: "Use of Service",
    content:
      "FiskGrad is an academic planning tool intended for personal, non-commercial use by students. You agree not to misuse the service, attempt to gain unauthorized access to any part of the platform, scrape or harvest data, or use FiskGrad in any way that could harm other users or the integrity of the platform. We reserve the right to suspend or permanently terminate accounts that violate these terms without prior notice.",
  },
  {
    number: "03",
    title: "User Accounts",
    content:
      "You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must provide accurate, current, and complete information when creating an account and update it promptly if anything changes. Notify us immediately at support@fiskgrad.app if you suspect unauthorized use of your account. We are not liable for any loss resulting from unauthorized access caused by your failure to protect your credentials.",
  },
  {
    number: "04",
    title: "Intellectual Property",
    content:
      "All content, design, and functionality of FiskGrad — including but not limited to the software, text, graphics, and course data — is the exclusive property of FiskGrad and its licensors, protected by copyright, trademark, and other intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the service for its intended purpose. You may not reproduce, distribute, modify, or create derivative works without our express written permission.",
  },
  {
    number: "05",
    title: "Disclaimer of Warranties",
    content:
      "FiskGrad is provided \"as is\" and \"as available\" without warranties of any kind, express or implied, including warranties of merchantability, fitness for a particular purpose, or non-infringement. We do not guarantee that the service will be uninterrupted, error-free, or that academic planning data will always be accurate, complete, or current. Course requirements, prerequisites, and graduation rules change over time. Always verify your degree requirements with your official academic advisor or institution registrar before making enrollment decisions.",
  },
  {
    number: "06",
    title: "Limitation of Liability",
    content:
      "To the fullest extent permitted by applicable law, FiskGrad and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of — or inability to use — the service. This includes, without limitation, academic decisions made based on information provided by FiskGrad, loss of data, or loss of academic standing. Our total cumulative liability to you shall not exceed the greater of $100 USD or the amount you paid for the service in the twelve months preceding the claim.",
  },
  {
    number: "07",
    title: "Changes to Terms",
    content:
      "We may revise these Terms of Service from time to time to reflect changes in law, our practices, or the features we offer. We will notify registered users of material changes via email or an in-app notice at least 14 days before they take effect. If you disagree with the revised terms, you may close your account before the changes become effective. Your continued use of FiskGrad after the effective date constitutes acceptance of the updated terms.",
  },
  {
    number: "08",
    title: "Governing Law",
    content:
      "These Terms of Service are governed by and construed in accordance with the laws of the United States, without regard to conflict of law principles. Any disputes arising under or in connection with these terms shall be subject to the exclusive jurisdiction of the courts located in the United States. If any provision of these terms is found to be unenforceable, the remaining provisions will continue in full force and effect.",
  },
  {
    number: "09",
    title: "Contact",
    content: null,
    isContact: true,
  },
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Nav */}
      <header className="flex items-center justify-between px-6 md:px-12 h-16 border-b border-border sticky top-0 bg-background/95 backdrop-blur z-20">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <GraduationCap className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-foreground tracking-tight">FiskGrad</span>
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
            <FileText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-1">Terms of Service</h1>
            <p className="text-sm text-muted-foreground">
              Last updated: <span className="font-medium text-foreground">April 4, 2026</span>
            </p>
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed max-w-lg">
              Please read these terms carefully before using FiskGrad. By using the service, you agree to be bound by them.
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
                  If you have any questions about these Terms of Service, please reach out to us at{" "}
                  <a
                    href="mailto:support@fiskgrad.app"
                    className="text-primary hover:underline font-medium"
                  >
                    support@fiskgrad.app
                  </a>
                  . We aim to respond to all inquiries within two business days. You can also reach us by mail at FiskGrad, Inc., United States.
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
            These terms were last reviewed and updated on April 4, 2026. If you have a disability and need these terms in an alternative format, please contact{" "}
            <a href="mailto:support@fiskgrad.app" className="text-primary hover:underline">
              support@fiskgrad.app
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="border-t border-border py-6 px-6 md:px-12 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-3.5 h-3.5" />
          <span>FiskGrad &copy; 2026</span>
        </div>
        <div className="flex gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
        </div>
      </footer>
    </div>
  );
}
