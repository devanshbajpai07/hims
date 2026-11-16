import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight,
  Menu,
  X,
  Activity,
  LogIn,
  ChevronDown,
  Building2,
  Stethoscope,
  ShieldCheck,
} from 'lucide-react';

interface NavbarProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPath = '/',
  onNavigate,
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loginDropdownOpen, setLoginDropdownOpen] = useState(false);
  const dropdownCloseTimeout = useRef<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 15);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Handle clicking outside to close login dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLoginDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnterLogin = () => {
    if (dropdownCloseTimeout.current) {
      clearTimeout(dropdownCloseTimeout.current);
      dropdownCloseTimeout.current = null;
    }
    setLoginDropdownOpen(true);
  };

  const handleMouseLeaveLogin = () => {
    dropdownCloseTimeout.current = setTimeout(() => {
      setLoginDropdownOpen(false);
    }, 240);
  };

  const handleSectionClick = (e: React.MouseEvent, sectionId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);

    if (currentPath !== '/') {
      onNavigate('/');
      setTimeout(() => {
        const el = document.getElementById(sectionId);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } else {
      const el = document.getElementById(sectionId);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    if (currentPath === '/') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      onNavigate('/');
    }
  };

  const navLinks = [
    { label: 'Home', isHome: true, path: '/' },
    { label: 'Pricing', path: '/pricing' },
    { label: 'Community', sectionId: 'community' },
    { label: 'About Us', sectionId: 'about' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 font-sans ${
        mobileMenuOpen
          ? 'bg-[#FAF7F2] dark:bg-obsidian-950 border-b border-stone-200/80 dark:border-white/10 py-0'
          : scrolled
          ? 'bg-[#FAF7F2]/95 dark:bg-obsidian-950/95 backdrop-blur-xl border-b border-stone-200/80 dark:border-white/10 shadow-soft-sm py-0'
          : 'bg-transparent py-2 sm:py-3'
      }`}
    >
      {/* Expanded Max Width (1536px) & Generous Padding to shift logo left & buttons right */}
      <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-10 lg:px-14 h-16 sm:h-22 flex items-center justify-between">
        {/* Brand Logo (Enlarged & shifted towards left margin) */}
        <button
          onClick={handleHomeClick}
          className="flex items-center gap-2.5 sm:gap-3.5 group text-left outline-none cursor-pointer"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform shrink-0">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white font-sans">
              Aarogya
            </span>
          </div>
        </button>

        {/* ============================================================= */}
        {/* RIGHT-ALIGNED TITLE BAR BUTTONS & UNIFIED LOGIN               */}
        {/* Shifted more to the right, enlarged, hover-only underline     */}
        {/* ============================================================= */}
        <div className="hidden md:flex items-center gap-9 lg:gap-11">
          {/* Equi-spaced Nav Links */}
          <nav className="flex items-center gap-8 lg:gap-10 text-base lg:text-[17px] font-semibold text-slate-700 dark:text-slate-200 font-sans">
            {navLinks.map((item) => {
              return (
                <button
                  key={item.label}
                  onClick={(e) => {
                    if (item.isHome) handleHomeClick(e);
                    else if (item.path) {
                      onNavigate(item.path);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    } else if (item.sectionId) {
                      handleSectionClick(e, item.sectionId);
                    }
                  }}
                  className="relative group/link py-2 px-1 outline-none transition-colors cursor-pointer hover:text-slate-950 dark:hover:text-white"
                >
                  <span className="tracking-tight">{item.label}</span>

                  {/* Arched Underline Stroke: strictly HOVER ONLY (Never permanent on open) */}
                  <svg
                    className="absolute -bottom-1 left-0 w-full h-2 text-teal-600 transition-all duration-300 transform pointer-events-none scale-x-0 opacity-0 group-hover/link:scale-x-100 group-hover/link:opacity-100 origin-left"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    fill="none"
                  >
                    <path
                      d="M 2 5 Q 50 1, 98 5"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              );
            })}
          </nav>

          {/* =========================================================== */}
          {/* Unified Login Button & Dropdown (Bigger, matches proportion) */}
          {/* =========================================================== */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={handleMouseEnterLogin}
            onMouseLeave={handleMouseLeaveLogin}
          >
            <button
              onClick={() => setLoginDropdownOpen(!loginDropdownOpen)}
              className="px-7 py-3 sm:px-8 sm:py-3.5 rounded-full text-base sm:text-[17px] font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-native-glow transition-all duration-200 flex items-center gap-2.5 group cursor-pointer border border-emerald-400/30 font-sans"
              aria-expanded={loginDropdownOpen}
              aria-haspopup="true"
            >
              <LogIn className="w-5 h-5 transition-transform group-hover:scale-110" />
              <span>Login</span>
              <ChevronDown
                className={`w-4.5 h-4.5 transition-transform duration-200 ${loginDropdownOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {/* Floating Dropdown: Aligned to Center of Login Button */}
            {loginDropdownOpen && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full mt-2.5 z-50"
                onMouseEnter={handleMouseEnterLogin}
                onMouseLeave={handleMouseLeaveLogin}
              >
                <div className="w-56 sm:w-60 bg-white rounded-2xl shadow-xl border border-stone-200/90 p-1.5 text-slate-800 animate-in fade-in duration-150 select-none backdrop-blur-xl font-sans">
                  {/* Option 1: Enterprise Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginDropdownOpen(false);
                      onNavigate('/account/login');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="no-lift w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-emerald-50/80 text-slate-800 hover:text-emerald-950 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Building2 className="w-4.5 h-4.5 text-emerald-600 group-hover:scale-105 transition-transform" />
                      <span className="text-sm font-semibold tracking-tight">Enterprise Login</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Option 2: Hospital Admin Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginDropdownOpen(false);
                      onNavigate('/admin/login');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="no-lift w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-emerald-50/80 text-slate-800 hover:text-emerald-950 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 group-hover:scale-105 transition-transform" />
                      <span className="text-sm font-semibold tracking-tight">Admin Login</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700 group-hover:translate-x-0.5 transition-all" />
                  </button>

                  {/* Option 3: Employee Login */}
                  <button
                    type="button"
                    onClick={() => {
                      setLoginDropdownOpen(false);
                      onNavigate('/login');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="no-lift w-full flex items-center justify-between px-3.5 py-3 rounded-xl hover:bg-teal-50/80 text-slate-800 hover:text-teal-950 transition-colors text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <Stethoscope className="w-4.5 h-4.5 text-teal-600 group-hover:scale-105 transition-transform" />
                      <span className="text-sm font-semibold tracking-tight">Employee Login</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-all" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="md:hidden flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-stone-200/50 transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu (Full-Height Sheet Overlay) */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 sm:top-22 bottom-0 bg-[#FAF7F2]/98 dark:bg-obsidian-950/98 backdrop-blur-2xl z-40 overflow-y-auto px-5 py-6 flex flex-col justify-between font-sans border-t border-stone-200/60 dark:border-white/10 animate-fadeIn">
          <div className="flex flex-col space-y-3.5 text-base font-semibold">
            <button
              onClick={handleHomeClick}
              className="text-left text-slate-800 dark:text-slate-200 py-2.5 px-3 rounded-xl hover:bg-stone-200/50 transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onNavigate('/pricing');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="text-left text-slate-800 dark:text-slate-200 py-2.5 px-3 rounded-xl hover:bg-stone-200/50 transition-colors"
            >
              Pricing
            </button>
            <button
              onClick={(e) => handleSectionClick(e, 'community')}
              className="text-left text-slate-800 dark:text-slate-200 py-2.5 px-3 rounded-xl hover:bg-stone-200/50 transition-colors"
            >
              Community
            </button>
            <button
              onClick={(e) => handleSectionClick(e, 'about')}
              className="text-left text-slate-800 dark:text-slate-200 py-2.5 px-3 rounded-xl hover:bg-stone-200/50 transition-colors"
            >
              About Us
            </button>

            <div className="pt-4 border-t border-stone-200/80 dark:border-white/10 flex flex-col space-y-3">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('/account/login');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-emerald-950 bg-white border border-emerald-300 shadow-2xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4.5 h-4.5 text-emerald-600" />
                  <span>Enterprise Login</span>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('/admin/login');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-emerald-950 bg-white border border-emerald-300 shadow-2xs flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
                  <span>Hospital Admin Login</span>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onNavigate('/login');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 flex items-center justify-between shadow-soft-sm"
              >
                <div className="flex items-center gap-2.5">
                  <Stethoscope className="w-4.5 h-4.5 text-white/90" />
                  <span>Employee Login</span>
                </div>
                <ArrowRight className="w-4 h-4 text-white/90" />
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-stone-200/60 text-xs text-slate-500 text-center">
            Aarogya Healthcare Information Management System
          </div>
        </div>
      )}
    </header>
  );
};
