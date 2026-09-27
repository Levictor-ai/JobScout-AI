/**
 * Canonical target profile.
 *
 * This is the single source of truth for what counts as a relevant role. It is consumed by
 * the AI matching system, the keyword ranker used by the live digest, and the Supabase
 * profile seed, so the three cannot drift apart.
 *
 * `targetTitles` is matched against the posting title. `descriptionKeywords` and `tools` are
 * matched against title plus description, and are the weaker signal on their own.
 */

export interface TargetGroup {
  label: string;
  titles: string[];
}

export const PRIMARY_JOB_TITLES: TargetGroup[] = [
  {
    label: 'Product Design',
    titles: [
      'Product Designer',
      'UI/UX Designer',
      'UX Designer',
      'Product UI Designer',
      'Product Design Engineer',
      'Design Engineer',
      'Digital Product Designer',
    ],
  },
  {
    label: 'Brand & Visual Design',
    titles: [
      'Brand & Visual Design',
      'Brand Designer',
      'Brand Identity Designer',
      'Visual Designer',
      'Graphic Designer',
      'Visual Identity Designer',
      'Creative Designer',
    ],
  },
  {
    label: 'AI / Emerging',
    titles: [
      'AI Product Designer',
      'AI UX Designer',
      'AI Designer',
      'AI Product Design',
      'Product Designer, AI',
      'Creative Technologist',
      'Design Technologist',
    ],
  },
  {
    label: 'Web & Digital',
    titles: ['Web Designer', 'Web/UI Designer', 'Digital Designer', 'Web Product Designer'],
  },
  {
    label: 'Hybrid / Builder',
    titles: [
      'Product Designer & Developer',
      'Product Engineer',
      'Design Engineer',
      'Frontend Designer',
      'No-Code Product Designer',
      'AI Product Builder',
    ],
  },
];

export const DESCRIPTION_KEYWORD_GROUPS: TargetGroup[] = [
  {
    label: 'Product Design',
    titles: [
      'Product design',
      'UI/UX',
      'User experience',
      'User interface',
      'User research',
      'User flows',
      'Wireframing',
      'Prototyping',
      'Design systems',
      'Component libraries',
      'MVP design',
      'Product strategy',
      'Design thinking',
      'Usability testing',
      'Developer handoff',
    ],
  },
  {
    label: 'Tools',
    titles: [
      'Figma',
      'FigJam',
      'Framer',
      'Adobe Photoshop',
      'Adobe Illustrator',
      'Adobe InDesign',
      'Spline',
      'After Effects',
      'AI design tools',
    ],
  },
  {
    label: 'Brand',
    titles: [
      'Brand identity',
      'Visual identity',
      'Logo design',
      'Brand systems',
      'Art direction',
      'Typography',
      'Packaging',
      'Marketing design',
      'Creative direction',
    ],
  },
  {
    label: 'AI / Building',
    titles: [
      'AI products',
      'AI-assisted design',
      'Generative AI',
      'AI workflows',
      'Prompt engineering',
      'Vibe coding',
      'No-code',
      'Low-code',
      'Prototyping with AI',
      'Product development',
    ],
  },
  {
    label: 'Web',
    titles: [
      'Web design',
      'Landing pages',
      'Responsive design',
      'Design systems',
      'Frontend collaboration',
      'HTML/CSS',
      'React',
      'Webflow',
      'Framer',
    ],
  },
];

export const TARGET_TITLES: string[] = PRIMARY_JOB_TITLES.flatMap((group) => group.titles);

export const DESCRIPTION_KEYWORDS: string[] = Array.from(
  new Set(DESCRIPTION_KEYWORD_GROUPS.flatMap((group) => group.titles).map((keyword) => keyword.toLowerCase()))
);

export const TOOL_KEYWORDS: string[] = DESCRIPTION_KEYWORD_GROUPS.find((group) => group.label === 'Tools')?.titles ?? [];

/** Grouped for display, so the UI can show the profile as the user wrote it. */
export const PROFILE_SECTIONS = {
  titles: PRIMARY_JOB_TITLES,
  description: DESCRIPTION_KEYWORD_GROUPS.filter((group) => group.label !== 'Tools'),
  tools: DESCRIPTION_KEYWORD_GROUPS.find((group) => group.label === 'Tools') ?? { label: 'Tools', titles: [] },
};
