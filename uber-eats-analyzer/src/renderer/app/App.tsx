import React, { useEffect, useState } from 'react';
import { Sidebar, type RouteKey } from '../components/Sidebar';
import { DashboardPage } from '../pages/DashboardPage';
import { EntryPage } from '../pages/EntryPage';
import { HistoryPage } from '../pages/HistoryPage';
import { ImportPage } from '../pages/ImportPage';
import { useShiftStore } from '../store/shiftStore';

export function App() {
  const [route, setRoute] = useState<RouteKey>('dashboard');
  const refresh = useShiftStore((s) => s.refresh);
  const toast = useShiftStore((s) => s.toast);
  const clearToast = useShiftStore((s) => s.clearToast);
  const apiAvailable = typeof window !== 'undefined' && 'uberApi' in window;

  useEffect(() => {
    if (apiAvailable) refresh();
  }, [apiAvailable, refresh]);

  return (
    <div className="h-full flex">
      <Sidebar current={route} onChange={setRoute} />
      <main className="flex-1 overflow-auto">
        {!apiAvailable && (
          <div className="m-4 panel p-4 border-warn/40 bg-warn/10 text-warn text-sm">
            Electron経由で起動されていません。<code>npm run dev</code> で起動するとSQLite接続が有効になります。
          </div>
        )}
        {route === 'dashboard' && <DashboardPage onJump={setRoute} />}
        {route === 'entry' && <EntryPage onSaved={() => setRoute('history')} />}
        {route === 'history' && <HistoryPage />}
        {route === 'import' && <ImportPage onDone={() => setRoute('history')} />}
      </main>

      {toast && (
        <div
          className="fixed bottom-6 right-6 panel px-4 py-3 border-accent/40 bg-accent/10 text-accent2 text-sm cursor-pointer"
          onClick={clearToast}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
