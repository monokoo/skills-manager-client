import { invoke } from '@tauri-apps/api/core';
import type { MarketplaceSkill } from '../../types';

// --- Types ---

export interface SkillsShSkill {
  id: string;
  skillId: string;
  name: string;
  installs: number;
  source: string; // e.g. "vercel-labs/agent-skills"
}

export interface SkillsShResult {
  query: string;
  searchType: string;
  skills: SkillsShSkill[];
  count: number;
  duration_ms: number;
}

// --- Helpers ---

function parseSource(source: string): { owner: string; repo: string } {
  const parts = source.split('/');
  return {
    owner: parts[0] ?? '',
    repo: parts.slice(1).join('/') || '',
  };
}

// --- Mapping ---

export function mapToMarketplaceSkill(skill: SkillsShSkill): MarketplaceSkill {
  const { owner } = parseSource(skill.source);
  return {
    id: `skillssh-${skill.id}`,
    name: skill.name,
    author: owner,
    authorAvatar: `https://github.com/${owner}.png?size=64`,
    description: `${skill.source} · ${skill.installs.toLocaleString()} installs`,
    githubUrl: `https://github.com/${skill.source}`,
    stars: 0,
    forks: 0,
    updatedAt: Date.now(),
    hasMarketplace: false,
    path: skill.skillId,
    branch: 'main',
    sourceType: 'skillssh',
    installs: skill.installs,
  };
}

// --- Public API (via Rust invoke proxy to bypass CORS) ---

export async function fetchSkillsSh(
  query: string,
  signal: AbortSignal
): Promise<MarketplaceSkill[]> {
  if (!query.trim()) return [];

  // Invoke Rust backend which uses curl to bypass CORS
  const data = await invoke<SkillsShResult>('search_skills_sh', {
    query: query.trim(),
  });

  if (signal.aborted) return [];

  // Dedup by skillId within the same source to prevent duplicate entries
  const seen = new Set<string>();
  const uniqueSkills = (data.skills ?? []).filter(s => {
    const key = `${s.source}/${s.skillId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueSkills.map(mapToMarketplaceSkill);
}
