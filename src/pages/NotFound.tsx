import { Link } from "react-router-dom";
import { GraduationCap, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
          <GraduationCap className="w-10 h-10 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold text-foreground mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">
          Oops! This page doesn't exist in your academic plan.
        </p>
        <Button asChild className="gap-2 bg-accent hover:bg-accent/90 text-accent-foreground">
          <Link to="/">
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
