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
    <header className="relative z-10 w-full py-2 sm:py-3 font-sans">
      <div className="w-full max-w-[1536px] mx-auto px-4 sm:px-10 lg:px-14 h-16 sm:h-22 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand Logo & Enterprise Portal Title */}
        <button
          onClick={() => onNavigate(targetHome)}
          className="flex items-center gap-2.5 sm:gap-3.5 group text-left outline-none cursor-pointer shrink min-w-0"
        >
          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-slate-900 text-white flex items-center justify-center font-bold shadow-sm group-hover:scale-105 transition-transform shrink-0">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </div>
          <div className="flex flex-col text-left min-w-0">
            <span className="font-sans text-xl sm:text-3xl font-extrabold tracking-tight text-slate-950 leading-none truncate">
              Aarogya
            </span>
            <span className="text-[8.5px] sm:text-[10px] font-mono uppercase tracking-wider text-teal-800 font-semibold mt-0.5 sm:mt-1 truncate">
              Enterprise Portal
            </span>
          </div>
        </button>

        {/* Right Actions: Account Settings Icon & Back to Home Button */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {onOpenSettings && (
            <button
              type="button"
              onClick={onOpenSettings}
              className={`relative h-9 w-9 sm:h-13 sm:w-13 rounded-full border flex items-center justify-center transition-all cursor-pointer font-sans shrink-0 ${
                isPendingDeletion
                  ? 'bg-amber-50 border-amber-400 text-amber-800 hover:bg-amber-100 shadow-sm'
                  : 'bg-white border-slate-200/90 text-slate-700 hover:text-teal-900 hover:border-teal-600 hover:shadow-soft-md shadow-soft-sm'
              }`}
              title="Enterprise Account Settings (Change Name, Email, Password, Deletion)"
              aria-label="Enterprise Account Settings"
            >
              <UserCog className="w-4 h-4 sm:w-6 sm:h-6" />
              {isPendingDeletion && (
                <span className="absolute -top-0.5 -right-0.5 w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-amber-500 border-2 border-white animate-pulse" />
              )}
            </button>
          )}

          {/* Back to Home Button */}
          <button
            onClick={() => onNavigate(targetHome)}
            className="px-3.5 py-2 sm:px-8 sm:py-3.5 rounded-full text-xs sm:text-[17px] font-semibold text-white bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 shadow-md hover:shadow-native-glow transition-all duration-200 flex items-center gap-1.5 sm:gap-2.5 group cursor-pointer border border-emerald-400/30 font-sans shrink-0"
            title={isEnterpriseHome ? 'Return to Aarogya Website' : 'Return to Enterprise Portal Home'}
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-5 sm:h-5 transition-transform group-hover:-translate-x-1" />
            <span className="hidden xs:inline sm:hidden">{isEnterpriseHome ? 'Home' : 'Back'}</span>
            <span className="hidden sm:inline">Back to Home</span>
            <span className="xs:hidden sm:hidden">{isEnterpriseHome ? 'Home' : 'Back'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};


