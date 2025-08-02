export enum IntakeType {
  JANUARY = 'JANUARY',
  APRIL_MAY = 'APRIL_MAY',
  SEPTEMBER = 'SEPTEMBER',
}

export const DEFAULT_INTAKES = [
  {
    name: 'january',
    type: IntakeType.JANUARY,
    displayName: 'January',
  },
  {
    name: 'april-may',
    type: IntakeType.APRIL_MAY,
    displayName: 'April/May',
  },
  {
    name: 'september',
    type: IntakeType.SEPTEMBER,
    displayName: 'September',
  },
] as const;

export type IntakeName = (typeof DEFAULT_INTAKES)[number]['name'];
