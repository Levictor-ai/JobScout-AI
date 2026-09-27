import type { AtsType, Json } from '@/types';

export interface DefaultCompany {
  name: string;
  website: string;
  careersUrl: string;
  atsType: AtsType;
  atsIdentifier: string;
}

/**
 * Every identifier below was verified against its live public job board API.
 * `lever` is intentionally absent: api.lever.co/v0/postings/* currently answers 404
 * for every board tested, so there is no verified public endpoint to read.
 */
export const DEFAULT_COMPANIES: DefaultCompany[] = [
  {
    name: 'Figma',
    website: 'https://figma.com',
    careersUrl: 'https://figma.com/careers',
    atsType: 'greenhouse',
    atsIdentifier: 'figma',
  },
  {
    name: 'Vercel',
    website: 'https://vercel.com',
    careersUrl: 'https://vercel.com/careers',
    atsType: 'greenhouse',
    atsIdentifier: 'vercel',
  },
  {
    name: 'Stripe',
    website: 'https://stripe.com',
    careersUrl: 'https://stripe.com/jobs',
    atsType: 'greenhouse',
    atsIdentifier: 'stripe',
  },
  {
    name: 'Anthropic',
    website: 'https://anthropic.com',
    careersUrl: 'https://anthropic.com/careers',
    atsType: 'greenhouse',
    atsIdentifier: 'anthropic',
  },
  {
    name: 'Webflow',
    website: 'https://webflow.com',
    careersUrl: 'https://webflow.com/careers',
    atsType: 'greenhouse',
    atsIdentifier: 'webflow',
  },
  {
    name: 'Intercom',
    website: 'https://intercom.com',
    careersUrl: 'https://intercom.com/careers',
    atsType: 'greenhouse',
    atsIdentifier: 'intercom',
  },
  {
    name: 'Typeform',
    website: 'https://typeform.com',
    careersUrl: 'https://typeform.com/careers',
    atsType: 'greenhouse',
    atsIdentifier: 'typeform',
  },
  {
    name: 'Linear',
    website: 'https://linear.app',
    careersUrl: 'https://linear.app/careers',
    atsType: 'ashby',
    atsIdentifier: 'linear',
  },
  {
    name: 'Notion',
    website: 'https://notion.so',
    careersUrl: 'https://notion.so/careers',
    atsType: 'ashby',
    atsIdentifier: 'notion',
  },
  {
    name: 'Cursor',
    website: 'https://cursor.com',
    careersUrl: 'https://cursor.com/careers',
    atsType: 'ashby',
    atsIdentifier: 'cursor',
  },
  {
    name: 'Supabase',
    website: 'https://supabase.com',
    careersUrl: 'https://supabase.com/careers',
    atsType: 'ashby',
    atsIdentifier: 'supabase',
  },
  {
    name: 'Midjourney',
    website: 'https://midjourney.com',
    careersUrl: 'https://midjourney.com/careers',
    atsType: 'ashby',
    atsIdentifier: 'midjourney',
  },
];

export function toCompanyRow(company: DefaultCompany): Record<string, Json> {
  return {
    name: company.name,
    website: company.website,
    careers_url: company.careersUrl,
    ats_type: company.atsType,
    ats_identifier: company.atsIdentifier,
    active: true,
    updated_at: new Date().toISOString(),
  };
}
