import React from 'react';
import { Navbar } from '../components/marketing/Navbar';
import { HeroSection } from '../components/marketing/HeroSection';
import { ProductIntroSection } from '../components/marketing/ProductIntroSection';
import { FeaturesSection } from '../components/marketing/FeaturesSection';
import { ConnectedEcosystemSection } from '../components/marketing/ConnectedEcosystemSection';
import { CommunitySection } from '../components/marketing/CommunitySection';
import { AboutUsSection } from '../components/marketing/AboutUsSection';
import { FooterSection } from '../components/marketing/FooterSection';
import { GradientBackground } from '../components/marketing/GradientBackground';

interface LandingPageProps {
  onNavigate: (path: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onNavigate }) => {
  const handleScrollToDemo = () => {
    const el = document.getElementById('cta-demo');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
    else onNavigate('/pricing');
  };

  const handleExploreProduct = () => {
    const el = document.getElementById('platform');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative min-h-screen text-slate-900 selection:bg-emerald-500 selection:text-white overflow-x-hidden bg-[#FAF7F2]">
      {/* 3-Color Sunrise Aurora Gradient Background (Full-screen, zero dot animations) */}
      <GradientBackground />

      {/* Sticky Top Navigation */}
      <Navbar currentPath="/" onNavigate={onNavigate} />

      {/* Main Content Sections */}
      <div className="relative z-10">
        {/* Hero Section */}
        <HeroSection
          onScheduleDemo={handleScrollToDemo}
          onExploreProduct={handleExploreProduct}
        />

        {/* Product Introduction with High-Fidelity UI Frame */}
        <ProductIntroSection onLaunchApp={() => onNavigate('/login')} />

        {/* Core Capabilities Bento Features */}
        <FeaturesSection />

        {/* Connected 4-Persona Ecosystem (Dark Mode Section) */}
        <ConnectedEcosystemSection />

        {/* Clinical Community */}
        <CommunitySection />

        {/* About Us & Philosophy */}
        <AboutUsSection />

        {/* Closing Impact CTA & Professional Footer */}
        <FooterSection onNavigate={onNavigate} />
      </div>
    </div>
  );
};
