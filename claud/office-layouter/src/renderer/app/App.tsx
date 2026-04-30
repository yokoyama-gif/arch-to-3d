import React, { useEffect } from "react";
import { Toolbar } from "../components/toolbar/Toolbar";
import { Sidebar } from "../components/sidebar/Sidebar";
import { Canvas } from "../components/canvas/Canvas";
import { Inspector } from "../components/inspector/Inspector";
import { EvaluationPanel } from "../components/report/EvaluationPanel";
import { useProjectStore } from "../store/projectStore";

export const App: React.FC = () => {
  const deleteObject = useProjectStore((s) => s.deleteObject);
  const rotateObject = useProjectStore((s) => s.rotateObject);
  const selectedId = useProjectStore((s) => s.selectedObjectId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!selectedId) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteObject(selectedId);
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        rotateObject(selectedId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, deleteObject, rotateObject]);

  return (
    <div className="h-full flex flex-col">
      <Toolbar />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">
          <Canvas />
          <EvaluationPanel />
        </main>
        <Inspector />
      </div>
    </div>
  );
};
