import React, { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Toolbar } from './components/Toolbar';
import { ObjectPanel } from './components/ObjectPanel';
import { PlanCanvas } from './components/PlanCanvas';
import { PropertyPanel } from './components/PropertyPanel';
import { CompareView } from './components/CompareView';

function App() {
  const { viewMode, loadFromLocalStorage } = useStore();

  useEffect(() => {
    loadFromLocalStorage();
  }, []);

  return (
    <div style={styles.app}>
      <Toolbar />
      <div style={styles.main}>
        {viewMode === 'plan' ? (
          <>
            <ObjectPanel />
            <PlanCanvas />
            <PropertyPanel />
          </>
        ) : viewMode === 'compare' ? (
          <CompareView />
        ) : null}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    fontFamily: "'Hiragino Sans', 'Yu Gothic', 'Meiryo', sans-serif",
  },
  main: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
};

export default App;
