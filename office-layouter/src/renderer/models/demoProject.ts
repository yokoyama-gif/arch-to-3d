import { createPlanFromTemplate } from './factories';
import { layoutTemplates } from './templates';
import type { LayoutObject, Project, ProjectSettings } from './types';

const getObjectByLibraryItem = (objects: LayoutObject[], libraryItemId: string) =>
  objects.find((object) => object.libraryItemId === libraryItemId);

export const createDemoProject = (settings: ProjectSettings): Project => {
  const plans = layoutTemplates.map((template) => createPlanFromTemplate(template, settings));

  const clientFacingPlan = plans.find((plan) => plan.name === '来客対応重視');
  if (clientFacingPlan) {
    const reception = getObjectByLibraryItem(clientFacingPlan.objects, 'reception-counter');
    if (reception) {
      reception.name = '総合受付';
    }
  }

  const densePlan = plans.find((plan) => plan.name === '高密度執務');
  if (densePlan) {
    const locker = getObjectByLibraryItem(densePlan.objects, 'locker');
    if (locker) {
      locker.name = '個人ロッカー';
    }
  }

  return {
    id: 'project-demo',
    name: 'オフィスレイアウター MVP',
    createdAt: '2026-04-04T09:00:00.000Z',
    updatedAt: '2026-04-04T09:00:00.000Z',
    settings,
    customLibrary: [],
    plans,
  };
};
