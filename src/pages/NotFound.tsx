import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen bg-background grid-pattern flex items-center justify-center">
      <div className="terminal-panel p-8 text-center max-w-md">
        <h1 className="text-6xl font-display font-bold text-primary glow-text mb-4">404</h1>
        <p className="text-muted-foreground mb-6 font-mono">Oops! Page not found</p>
        <Link 
          to="/" 
          className="inline-block px-6 py-2 bg-primary text-primary-foreground rounded font-display hover:bg-primary/90 transition-colors"
        >
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
