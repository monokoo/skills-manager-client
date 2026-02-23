import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Star, GitFork, ExternalLink, Clock, Download, AlertCircle, FileText } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import type { MarketplaceSkill } from '../../types';
import { parseFrontmatter } from '../../lib/markdownUtils';

// --- Types ---

interface RepoDetail {
  stargazers_count: number;
  forks_count: number;
  description: string;
  html_url: string;
  updated_at: string;
  language: string;
  license: { name: string } | null;
  default_branch: string;
}

interface DrawerState {
  status: 'idle' | 'loading' | 'loaded' | 'error';
  readme: string;
  repo: RepoDetail | null;
  error: string;
  docLabel: string;   // "SKILL.md" or "README"
  sourceUrl: string;  // resolved URL to skill directory
}

// --- Props ---

interface SkillDetailDrawerProps {
  skill: MarketplaceSkill | null;
  isOpen: boolean;
  onClose: () => void;
  onInstall?: (skill: MarketplaceSkill) => void;
  isInstalled?: boolean;
}

// --- Cache (avoids hitting GitHub's 60 req/hr unauthenticated limit) ---

interface CachedDetail {
  repo: RepoDetail | null;
  readme: string;
  sourceUrl: string;
  docLabel: string;
  cachedAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const detailCache = new Map<string, CachedDetail>();

function getCachedDetail(key: string): CachedDetail | null {
  const entry = detailCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    detailCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedDetail(key: string, repo: RepoDetail | null, readme: string, sourceUrl: string, docLabel: string): void {
  detailCache.set(key, { repo, readme, sourceUrl, docLabel, cachedAt: Date.now() });
}

// --- Skeleton ---

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-gray-200 dark:bg-white/10 rounded-lg ${className}`} />
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Skeleton className="w-14 h-14 rounded-2xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
      <div className="space-y-3 mt-8">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    </div>
  );
}

// --- Helpers ---

function extractOwnerRepo(skill: MarketplaceSkill): { owner: string; repo: string } | null {
  try {
    const url = new URL(skill.githubUrl);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
    }
  } catch { /* ignore invalid URLs */ }
  return null;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// Markdown renderer with frontmatter metadata card and GFM support
function MarkdownContent({ content }: { content: string }) {
  const { meta, body } = parseFrontmatter(content);
  const metaEntries = Object.entries(meta);

  return (
    <>
      {metaEntries.length > 0 && (
        <div className="frontmatter-wrapper">
          <table className="frontmatter-table">
            <tbody>
              {metaEntries.map(([key, value]) => (
                <tr key={key}>
                  <td className="frontmatter-key">{key}</td>
                  <td className="frontmatter-value">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>{body}</Markdown>
    </>
  );
}

// --- Component ---

export default function SkillDetailDrawer({
  skill,
  isOpen,
  onClose,
  onInstall,
  isInstalled = false,
}: SkillDetailDrawerProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<DrawerState>({
    status: 'idle',
    readme: '',
    repo: null,
    error: '',
    docLabel: 'README',
    sourceUrl: '',
  });
  const [retryKey, setRetryKey] = useState(0);

  const fetchDetails = useCallback(async (s: MarketplaceSkill, signal: AbortSignal) => {
    const parsed = extractOwnerRepo(s);
    if (!parsed) {
      setState({ status: 'error', readme: '', repo: null, error: 'Invalid GitHub URL', docLabel: 'README', sourceUrl: '' });
      return;
    }

    const cacheKey = `${parsed.owner}/${parsed.repo}/${s.path ?? ''}`;

    // Check cache first
    const cached = getCachedDetail(cacheKey);
    if (cached) {
      setState({ status: 'loaded', readme: cached.readme, repo: cached.repo, error: '', docLabel: cached.docLabel, sourceUrl: cached.sourceUrl });
      return;
    }

    setState({ status: 'loading', readme: '', repo: null, error: '', docLabel: 'README', sourceUrl: '' });

    try {
      const base = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
      const rawHeader = { Accept: 'application/vnd.github.raw+json' };

      // Fetch repo info
      const repoRes = await fetch(base, { signal }).catch(() => null);
      if (signal.aborted) return;

      const repo = repoRes?.ok
        ? await repoRes.json() as RepoDetail
        : null;

      // Discover SKILL.md path via git/trees (skillId ≠ GitHub directory path)
      let readme = '';
      let docLabel = 'README';
      let resolvedSourceUrl = '';
      const skillName = s.name || s.path || '';

      if (skillName) {
        try {
          const branch = repo?.default_branch || 'main';
          const treeRes = await fetch(`${base}/git/trees/${branch}?recursive=1`, { signal });
          if (treeRes.ok) {
            const treeData = await treeRes.json() as { tree: { path: string; type: string }[] };
            // Find SKILL.md whose parent directory matches or contains the skill name
            const skillMdFiles = treeData.tree
              .filter(f => f.path.endsWith('/SKILL.md'))
              .map(f => f.path);

            // Match strategy: find path whose directory name matches skill name (may strip prefix)
            const matched = skillMdFiles.find(p => {
              const dir = p.split('/').slice(-2, -1)[0]; // parent directory name
              return dir === skillName || skillName.endsWith(dir) || dir.endsWith(skillName);
            });

            if (matched) {
              const docRes = await fetch(`${base}/contents/${matched}`, {
                signal, headers: rawHeader,
              });
              if (docRes.ok) {
                readme = await docRes.text();
                docLabel = 'SKILL.md';
                // Build source URL to the skill directory
                const skillDir = matched.replace(/\/SKILL\.md$/, '');
                resolvedSourceUrl = `https://github.com/${parsed.owner}/${parsed.repo}/tree/${branch}/${skillDir}`;
              }
            }
          }
        } catch { /* fall through to root readme */ }
      }

      // Fallback: repo root README
      if (!readme && !signal.aborted) {
        try {
          const fallback = await fetch(`${base}/readme`, { signal, headers: rawHeader });
          if (fallback.ok) readme = await fallback.text();
        } catch { /* ignore */ }
      }

      // Write to cache
      setCachedDetail(cacheKey, repo, readme, resolvedSourceUrl, docLabel);

      setState({ status: 'loaded', readme, repo, error: '', docLabel, sourceUrl: resolvedSourceUrl });
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setState({
        status: 'error',
        readme: '',
        repo: null,
        error: err instanceof Error ? err.message : 'Unknown error',
        docLabel: 'README',
        sourceUrl: '',
      });
    }
  }, []);

  useEffect(() => {
    if (!isOpen || !skill) {
      setState({ status: 'idle', readme: '', repo: null, error: '', docLabel: 'README', sourceUrl: '' });
      return;
    }

    const controller = new AbortController();
    fetchDetails(skill, controller.signal);
    return () => controller.abort();
  }, [isOpen, skill, fetchDetails, retryKey]);

  const handleOpenSource = async (url: string) => {
    try {
      await invoke('open_url', { url });
    } catch {
      window.open(url, '_blank');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && skill && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="relative w-full max-w-xl bg-white dark:bg-[#1E293B] border-l border-gray-200 dark:border-white/10 shadow-2xl h-full overflow-y-auto custom-scrollbar"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 text-gray-400 transition-colors"
            >
              <X size={18} />
            </button>

            {state.status === 'loading' ? (
              <DetailSkeleton />
            ) : state.status === 'error' ? (
              <div className="flex flex-col items-center justify-center h-64 gap-3 p-6">
                <AlertCircle className="text-red-400" size={32} />
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  {state.error || t('loadFailed', { defaultValue: '加载失败' })}
                </p>
                <button
                  onClick={() => setRetryKey(k => k + 1)}
                  className="px-4 py-2 text-sm font-medium text-blue-500 hover:bg-blue-500/10 rounded-xl transition-colors"
                >
                  {t('retry', { defaultValue: '重试' })}
                </button>
              </div>
            ) : state.status === 'idle' ? null : (
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-start gap-4 pr-8">
                  <div className="p-3 bg-white dark:bg-white/10 rounded-2xl shadow-sm border border-gray-100 dark:border-white/5 flex-shrink-0">
                    {skill.authorAvatar ? (
                      <img src={skill.authorAvatar} alt={skill.name} className="w-10 h-10 rounded-full" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                      {skill.name}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{skill.author}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex flex-wrap gap-2">
                  {state.repo && (
                    <>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full text-xs font-semibold">
                        <Star size={12} fill="currentColor" />
                        {state.repo.stargazers_count.toLocaleString()}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-gray-400 rounded-full text-xs font-semibold">
                        <GitFork size={12} />
                        {state.repo.forks_count.toLocaleString()}
                      </span>
                      {state.repo.language && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full text-xs font-semibold">
                          {state.repo.language}
                        </span>
                      )}
                      {state.repo.license && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-full text-xs font-semibold">
                          {state.repo.license.name}
                        </span>
                      )}
                    </>
                  )}
                  {skill.installs != null && skill.installs > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-full text-xs font-semibold">
                      <Download size={12} />
                      {skill.installs.toLocaleString()}
                    </span>
                  )}
                </div>

                {/* Description */}
                {(state.repo?.description || skill.description) && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {state.repo?.description || skill.description}
                  </p>
                )}

                {/* Updated At */}
                {state.repo?.updated_at && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock size={12} />
                    {t('updatedAt', { defaultValue: '更新于' })} {formatDate(state.repo.updated_at)}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleOpenSource(state.sourceUrl || skill.githubUrl)}
                    className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <ExternalLink size={14} />
                    {t('viewSource', { defaultValue: '查看源码' })}
                  </button>
                  {onInstall && (
                    <button
                      onClick={() => onInstall(skill)}
                      className={`flex-1 h-11 flex items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-md transition-all ${
                        isInstalled
                          ? 'bg-gradient-to-br from-amber-500 to-orange-600 hover:shadow-amber-500/25'
                          : 'bg-gradient-to-br from-blue-500 to-indigo-600 hover:shadow-blue-500/25'
                      }`}
                    >
                      <Download size={14} />
                      {isInstalled
                        ? t('reinstall', { defaultValue: '重新安装' })
                        : t('install', { defaultValue: '安装' })}
                    </button>
                  )}
                </div>

                {/* Document Content */}
                {state.readme && (
                  <div className="pt-4 border-t border-gray-200 dark:border-white/10">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/8 text-gray-600 dark:text-gray-300 rounded-t-lg text-xs font-mono font-semibold border border-b-0 border-gray-200 dark:border-white/10">
                      <FileText size={12} />
                      {state.docLabel || 'README'}
                    </div>
                    <div className="markdown-body">
                      <MarkdownContent content={state.readme} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
