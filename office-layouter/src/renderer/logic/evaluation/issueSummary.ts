import type { Issue, Severity } from '../../models/types';

export const issueCodeLabels: Record<Issue['code'], string> = {
  OUT_OF_ROOM: '部屋外',
  OVERLAP: '重なり',
  CORRIDOR: '通路',
  CHAIR_CLEARANCE: '椅子引き代',
  DOOR_BLOCKED: '扉前',
  RECEPTION_WAITING: '受付前',
  COPY_OPERATION: 'コピー前',
  MEETING_ENTRY: '会議入口',
  PRESSURE: '圧迫感',
  VISITOR_FLOW: '来客導線',
  ZONE_BALANCE: 'ゾーン',
  COMMON_USABILITY: '共用部',
};

export const severityLabels: Record<Severity, string> = {
  ok: 'OK',
  warning: '注意',
  ng: 'NG',
};

export const getIssueCountsByCode = (issues: Issue[]) =>
  issues.reduce<Partial<Record<Issue['code'], number>>>((acc, issue) => {
    acc[issue.code] = (acc[issue.code] ?? 0) + 1;
    return acc;
  }, {});

export const getIssueCountsBySeverity = (issues: Issue[]) =>
  issues.reduce<Record<Severity, number>>(
    (acc, issue) => {
      acc[issue.severity] += 1;
      return acc;
    },
    { ok: 0, warning: 0, ng: 0 },
  );

export const getSortedIssueBreakdown = (issues: Issue[]) =>
  Object.entries(getIssueCountsByCode(issues))
    .filter((entry): entry is [Issue['code'], number] => typeof entry[1] === 'number')
    .sort((left, right) => right[1] - left[1]);
