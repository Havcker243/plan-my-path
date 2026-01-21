import { motion } from 'framer-motion';
import { BookOpen, GraduationCap, BarChart3, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export function Landing() {
  const navigate = useNavigate();

  const features = [
    {
      icon: BookOpen,
      title: 'Smart Course Planning',
      description: 'Drag and drop courses across semesters with instant prerequisite validation.',
    },
    {
      icon: BarChart3,
      title: 'Progress Tracking',
      description: 'Visualize your degree progress with real-time GPA and credit calculations.',
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Suggestions',
      description: 'Get personalized recommendations based on your goals and constraints.',
    },
    {
      icon: GraduationCap,
      title: 'Graduation Forecasting',
      description: 'See your path to graduation with what-if scenarios and timeline views.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="hero-gradient min-h-[85vh] flex items-center justify-center relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-1/2 -left-1/2 w-full h-full bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="text-sm font-medium text-accent">Plan your academic journey</span>
            </motion.div>

            <h1 className="text-5xl md:text-7xl font-bold text-primary-foreground mb-6 leading-tight">
              Your 4-Year
              <span className="block gradient-text">Academic Planner</span>
            </h1>

            <p className="text-xl md:text-2xl text-primary-foreground/70 mb-10 max-w-2xl mx-auto">
              Plan smarter, graduate on time. The intelligent course planner that keeps you on track.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="flex flex-col sm:flex-row gap-4 justify-center"
            >
              <Button
                size="lg"
                onClick={() => navigate('/onboard')}
                className="bg-accent hover:bg-accent/90 text-accent-foreground text-lg px-8 py-6 shadow-glow"
              >
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate('/dashboard')}
                className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 text-lg px-8 py-6"
              >
                View Demo
              </Button>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <div className="w-6 h-10 rounded-full border-2 border-primary-foreground/30 flex justify-center pt-2">
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-1.5 h-1.5 rounded-full bg-primary-foreground/50"
            />
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything you need to succeed
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built by students, for students. Our planner understands the complexities of degree requirements.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="group p-6 bg-card rounded-xl border border-border card-hover"
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-muted/50">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="max-w-3xl mx-auto text-center bg-card rounded-2xl p-12 border border-border shadow-card"
          >
            <GraduationCap className="w-16 h-16 mx-auto mb-6 text-accent" />
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to plan your future?
            </h2>
            <p className="text-muted-foreground mb-8">
              Join thousands of students who've already optimized their academic journey.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/onboard')}
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8"
            >
              Start Planning Now
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-muted-foreground">
            Unofficial planning tool — verify with your academic advisor.
          </p>
        </div>
      </footer>
    </div>
  );
}
