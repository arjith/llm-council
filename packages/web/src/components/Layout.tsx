import { Outlet, Link } from 'react-router-dom';
import { Users, Activity, Github } from 'lucide-react';

export function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-council-dark to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-council-primary to-council-secondary flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">LLM Council</h1>
                <p className="text-xs text-gray-400">Multi-Model Consensus</p>
              </div>
            </Link>
            
            <nav className="flex items-center gap-6">
              <Link
                to="/"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <Activity className="w-4 h-4" />
                <span>Dashboard</span>
              </Link>
              <a
                href="https://github.com/karpathy/llm-council"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
              >
                <Github className="w-4 h-4" />
                <span>GitHub</span>
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 mt-auto">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>
            Inspired by{' '}
            <a 
              href="https://x.com/karpathy" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-council-primary hover:underline"
            >
              Andrej Karpathy
            </a>
            {' '}and{' '}
            <a
              href="https://x.com/satlosbos"
              target="_blank"
              rel="noopener noreferrer"
              className="text-council-primary hover:underline"
            >
              Satya Nadella
            </a>
            's discussions on LLM Councils
          </p>
        </div>
      </footer>
    </div>
  );
}
