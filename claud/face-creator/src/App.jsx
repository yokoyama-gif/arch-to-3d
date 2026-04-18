import LeftPanel from './components/LeftPanel'
import RightPanel from './components/RightPanel'

export default function App() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* ── 左カラム（固定幅、スクロール独立） ── */}
      <aside className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 overflow-hidden">
        <LeftPanel />
      </aside>

      {/* ── 右カラム（残り幅、スクロール独立） ── */}
      <main className="flex-1 min-w-0 overflow-hidden">
        <RightPanel />
      </main>
    </div>
  )
}
