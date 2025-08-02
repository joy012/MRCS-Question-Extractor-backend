export enum CategoryType {
  BASIC = 'BASIC',
  CLINICAL = 'CLINICAL',
}

export const DEFAULT_CATEGORIES = [
  {
    name: 'anatomy-thorax',
    displayName: 'Anatomy - Thorax',
    type: CategoryType.BASIC,
  },
  {
    name: 'anatomy-abdomen',
    displayName: 'Anatomy - Abdomen',
    type: CategoryType.BASIC,
  },
  {
    name: 'anatomy-superior-extremity',
    displayName: 'Anatomy - Superior Extremity',
    type: CategoryType.BASIC,
  },
  {
    name: 'anatomy-inferior-extremity',
    displayName: 'Anatomy - Inferior Extremity',
    type: CategoryType.BASIC,
  },
  {
    name: 'anatomy-head-neck-brain',
    displayName: 'Anatomy - Head, Neck & Brain',
    type: CategoryType.BASIC,
  },
  {
    name: 'physiology',
    displayName: 'Physiology',
    type: CategoryType.BASIC,
  },
  {
    name: 'pathology',
    displayName: 'Pathology',
    type: CategoryType.BASIC,
  },
  {
    name: 'microbiology',
    displayName: 'Microbiology',
    type: CategoryType.BASIC,
  },
  {
    name: 'biostatistics',
    displayName: 'Biostatistics',
    type: CategoryType.BASIC,
  },
  {
    name: 'clinical-git-colorectal-abdomen',
    displayName: 'Clinical - GIT, Colorectal & Abdomen',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-hepatobiliary-pancreas',
    displayName: 'Clinical - Hepatobiliary & Pancreas',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-urology',
    displayName: 'Clinical - Urology',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-orthopedics',
    displayName: 'Clinical - Orthopedics',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-breast-endocrine',
    displayName: 'Clinical - Breast & Endocrine',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-ent',
    displayName: 'Clinical - ENT',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-skin',
    displayName: 'Clinical - Skin',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-vascular-surgery',
    displayName: 'Clinical - Vascular Surgery',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-neurosurgery',
    displayName: 'Clinical - Neurosurgery',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-organ-transplantation',
    displayName: 'Clinical - Organ Transplantation',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-pediatric-surgery',
    displayName: 'Clinical - Pediatric Surgery',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-perioperative-care',
    displayName: 'Clinical - Perioperative care',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-post-operative-care',
    displayName: 'Clinical - Post operative care',
    type: CategoryType.CLINICAL,
  },
  {
    name: 'clinical-surgical-emergency-trauma',
    displayName: 'Clinical - Surgical Emergency & Trauma',
    type: CategoryType.CLINICAL,
  },
] as const;

export type CategoryName = (typeof DEFAULT_CATEGORIES)[number]['name'];
