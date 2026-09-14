import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { GlobalRealtime } from '@/components/GlobalRealtime';
import { SectionErrorBoundary } from '@/components/SectionErrorBoundary';

const SIDEBAR_COLLAPSED_KEY = 'sr-sidebar-collapsed';

export function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed]);

  const toggleSidebar = () => setSidebarCollapsed((prev) => !prev);

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="hidden md:flex">
        <SectionErrorBoundary label="sidebar" compact className="h-full w-full bg-navy text-white">
          <Sidebar collapsed={sidebarCollapsed} />
        </SectionErrorBoundary>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0 border-0">
          <SectionErrorBoundary label="sidebar" compact className="h-full w-full bg-navy text-white">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </SectionErrorBoundary>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 flex-col overflow-hidden">
        <GlobalRealtime />
        <SectionErrorBoundary label="top bar" compact className="h-16 shrink-0 border-b bg-card">
          <TopBar
            onMenuClick={() => setMobileOpen(true)}
            sidebarCollapsed={sidebarCollapsed}
            onSidebarToggle={toggleSidebar}
          />
        </SectionErrorBoundary>
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-6 scrollbar-thin">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
