import { LayoutCanvas } from '../components/canvas/LayoutCanvas';
import { ComparisonPanel } from '../components/comparison/ComparisonPanel';
import { InspectorPanel } from '../components/inspector/InspectorPanel';
import { EvaluationPanel } from '../components/report/EvaluationPanel';
import { LibraryPanel } from '../components/sidebar/LibraryPanel';
import { Toolbar } from '../components/toolbar/Toolbar';
import { useActivePlan, useProjectStore } from '../store/projectStore';

export const App = () => {
  const project = useProjectStore((state) => state.project);
  const selectedObjectId = useProjectStore((state) => state.selectedObjectId);
  const showComparison = useProjectStore((state) => state.showComparison);
  const activePlan = useActivePlan();

  const selectedObject = activePlan?.objects.find(
    (object) => object.id === selectedObjectId,
  );

  if (!activePlan) {
    return null;
  }

  return (
    <div className="h-full bg-[radial-gradient(circle_at_top,#ffffff_0%,#edf2f7_55%,#dbe5ef_100%)] p-4 text-ink">
      <div className="grid h-full grid-cols-[300px_minmax(0,1fr)_320px] grid-rows-[auto_minmax(0,1fr)_auto] gap-4">
        <div className="col-span-3">
          <Toolbar />
        </div>

        <div className="min-h-0">
          <LibraryPanel />
        </div>

        <div className="min-h-0">
          <LayoutCanvas plan={activePlan} selectedObjectId={selectedObjectId} />
        </div>

        <div className="min-h-0">
          <InspectorPanel plan={activePlan} selectedObject={selectedObject} />
        </div>

        <div className="col-span-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          {showComparison ? (
            <ComparisonPanel project={project} activePlanId={activePlan.id} />
          ) : (
            <div />
          )}
          <EvaluationPanel plan={activePlan} />
        </div>
      </div>
    </div>
  );
};
