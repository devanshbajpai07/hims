import React from 'react';
import { Activity, ArrowLeft, UserCog } from 'lucide-react';

interface PurchaserNavbarProps {
  currentPath?: string;
  onNavigate: (path: string) => void;
  hideNavLinks?: boolean;
  hideLogout?: boolean;
  onOpenSettings?: () => void;
  isPendingDeletion?: boolean;
  userInitials?: string;
}

export const PurchaserNavbar: React.FC<PurchaserNavbarProps> = ({
  currentPath,
  onNavigate,
  onOpenSettings,
  isPendingDeletion = false,
}) => {
  // Only on Enterprise Portal Home (/account/dashboard) does "Back to Home" take the user back to the website home (/)
  // On all other pages inside the Enterprise Portal, it takes the user back to the logged in Enterprise Portal Home (/account/dashboard)
  const isEnterpriseHome = currentPath === '/account/dashboard';
  const targetHome = isEnterpriseHome ? '/' : '/account/dashboard';

  return (
    <header className="relative z-10 w-full py-3 font-sans">
      <div className="w-full max-w-[1536px] mx-auto px-6 sm:px-10 lg:px-14 h-22 flex items-center justify-between">
        {/* Brand Logo & Enterprise Portal Title */}
        <button
          onClick={() => onNavigate(targetHome)}
          className="flex items-center gap-3.5 group text-left outline-none cursor-pointer"
        >
          <div className="w-11 h-11 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform">
            <Activity className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-sans text-3xl font-extrabold tracking-tight text-slate-950 leading-none">
              Aarogya
            </span>
            <span className="text-[10px] font-mono uppercase tracking-wider text-teal-800 font-semibold mt-1">
              Enterprise Portal
            </span>
          </div>
        </button>

        {/* Right Actions: Account Settings Icon & Back to Home Button */}
        <div className="flex items-center gap-3 sm:gap-4">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className={`relative h-12 w-12 sm:h-13 sm:w-13 rounded-full border flex items-center justify-center transition-all cursor-pointer font-sans ${
                isPendingDeletion
                  ? 'bg-amber-50 border-amber-400 text-amber-800 hover:bg-amber-100 shadow-sm'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:text-teal-900 hover:border-teal-600 hover:shadow-soft-md shadow-soft-sm'
              }`}
              title="Enterprise Account Settings (Change Name, Email, Password, Deletion)"
              aria-label="Enterprise Account Settings"
            >
              <UserCog className="w-5 h-5 sm:w-6 sm:h-6" />
              {isPendingDeletion && (
                <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-amber-500 border-2 border-white animate-pulse" />
              )}
            </button>
          )}

          {/* Back to Home Button */}
          <button
            onClick={() => onNavigate(targetHome)}
            className="px-7 py-3 sm:px-8 sm:py-3.5 rounded-full text-base sm:text-[17px] font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-native-glow transition-all duration-200 flex items-center gap-2.5 group cursor-pointer border border-emerald-400/30 font-sans shrink-0"
            title={isEnterpriseHome ? 'Return to Aarogya Website' : 'Return to Enterprise Portal Home'}
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>
    </header>
  );
};


