import type { Issue } from '../../models/types';

export const calculateScore = (issues: Issue[]) => {
  const penalty = issues.reduce((sum, issue) => {
    if (issue.severity === 'ng') {
      return sum + 18;
    }

    if (issue.severity === 'warning') {
      return sum + 8;
    }

    return sum;
  }, 0);

  return Math.max(0, 100 - penalty);
};
