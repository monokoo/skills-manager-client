use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use walkdir::WalkDir;

mod security;
use security::SecurityReport;

// 主目录配置
const PRIMARY_SKILLS_DIR: &str = ".claude/skills";

// Supported SKILL.md filename variants (uppercase + lowercase)
const SKILL_MD_VARIANTS: &[&str] = &["SKILL.md", "skill.md"];

/// Check if a filename is a valid skill markdown file (SKILL.md or skill.md)
fn is_skill_md(name: &std::ffi::OsStr) -> bool {
    SKILL_MD_VARIANTS.iter().any(|v| name == *v)
}

/// Find the skill markdown file in a directory, preferring SKILL.md over skill.md
fn find_skill_md(dir: &std::path::Path) -> Option<PathBuf> {
    for variant in SKILL_MD_VARIANTS {
        let p = dir.join(variant);
        if p.exists() {
            return Some(p);
        }
    }
    None
}

/// Check if a path string ends with a skill markdown filename
fn ends_with_skill_md(path: &str) -> bool {
    path.ends_with("/SKILL.md") || path.ends_with("/skill.md")
        || path == "SKILL.md" || path == "skill.md"
}

/// Trim the skill markdown filename suffix from a path
fn trim_skill_md_suffix(path: &str) -> &str {
    for variant in SKILL_MD_VARIANTS {
        let suffix = format!("/{}", variant);
        if let Some(stripped) = path.strip_suffix(suffix.as_str()) {
            return stripped;
        }
        if path == *variant {
            return "";
        }
    }
    path
}

// 代理配置 - 基于 skill-dir.md 标准
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub id: String,
    pub name: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "skillsDir")]
    pub skills_dir: String,
    #[serde(rename = "globalSkillsDir")]
    pub global_skills_dir: String,
    pub compatibility: String,  // "native" | "symlink"
    pub color: String,
}

// 软链接状态
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SymlinkStatus {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "agentName")]
    pub agent_name: String,
    #[serde(rename = "targetPath")]
    pub target_path: String,
    #[serde(rename = "linkPath")]
    pub link_path: String,
    pub exists: bool,
    #[serde(rename = "isValid")]
    pub is_valid: bool,
    pub error: Option<String>,
}

fn get_agent_configs() -> Vec<AgentConfig> {
    vec![
        // ==================== 原生兼容代理 ====================
        AgentConfig {
            id: "claude-code".to_string(),
            name: "claude-code".to_string(),
            display_name: "Claude Code".to_string(),
            skills_dir: ".claude/skills".to_string(),
            global_skills_dir: ".claude/skills".to_string(),
            compatibility: "native".to_string(),
            color: "#D97757".to_string(),
        },
        AgentConfig {
            id: "github-copilot".to_string(),
            name: "github-copilot".to_string(),
            display_name: "GitHub Copilot".to_string(),
            skills_dir: ".github/skills".to_string(),
            global_skills_dir: ".copilot/skills".to_string(),
            compatibility: "native".to_string(),
            color: "#000000".to_string(),
        },
        AgentConfig {
            id: "cursor".to_string(),
            name: "cursor".to_string(),
            display_name: "Cursor".to_string(),
            skills_dir: ".cursor/skills".to_string(),
            global_skills_dir: ".cursor/skills".to_string(),
            compatibility: "native".to_string(),
            color: "#00D4FF".to_string(),
        },
        AgentConfig {
            id: "opencode".to_string(),
            name: "opencode".to_string(),
            display_name: "OpenCode".to_string(),
            skills_dir: ".opencode/skill".to_string(),
            global_skills_dir: ".config/opencode/skill".to_string(),
            compatibility: "native".to_string(),
            color: "#6366F1".to_string(),
        },
        AgentConfig {
            id: "antigravity".to_string(),
            name: "antigravity".to_string(),
            display_name: "Antigravity".to_string(),
            skills_dir: ".agent/skills".to_string(),
            global_skills_dir: ".gemini/antigravity/skills".to_string(),
            compatibility: "symlink".to_string(),
            color: "#4285F4".to_string(),
        },
        AgentConfig {
            id: "amp".to_string(),
            name: "amp".to_string(),
            display_name: "Amp".to_string(),
            skills_dir: ".amp/skills".to_string(),
            global_skills_dir: ".amp/skills".to_string(),
            compatibility: "native".to_string(),
            color: "#FF6B6B".to_string(),
        },
        // ==================== 需要软链接的代理 ====================
        AgentConfig {
            id: "codex".to_string(),
            name: "codex".to_string(),
            display_name: "OpenAI Codex".to_string(),
            skills_dir: ".codex/skills".to_string(),
            global_skills_dir: ".codex/skills".to_string(),
            compatibility: "symlink".to_string(),
            color: "#10A37F".to_string(),
        },
        AgentConfig {
            id: "gemini-cli".to_string(),
            name: "gemini-cli".to_string(),
            display_name: "Gemini CLI".to_string(),
            skills_dir: ".gemini/skills".to_string(),
            global_skills_dir: ".gemini/skills".to_string(),
            compatibility: "symlink".to_string(),
            color: "#8E44AD".to_string(),
        },
        AgentConfig {
            id: "windsurf".to_string(),
            name: "windsurf".to_string(),
            display_name: "Windsurf".to_string(),
            skills_dir: ".windsurf/skills".to_string(),
            global_skills_dir: ".codeium/windsurf/skills".to_string(),
            compatibility: "symlink".to_string(),
            color: "#22C55E".to_string(),
        },
        AgentConfig {
            id: "roo".to_string(),
            name: "roo".to_string(),
            display_name: "Roo".to_string(),
            skills_dir: ".roo/skills".to_string(),
            global_skills_dir: ".roo/skills".to_string(),
            compatibility: "symlink".to_string(),
            color: "#F59E0B".to_string(),
        },
        AgentConfig {
            id: "trae".to_string(),
            name: "trae".to_string(),
            display_name: "Trae".to_string(),
            skills_dir: ".trae/skills".to_string(),
            global_skills_dir: ".trae/skills".to_string(),
            compatibility: "symlink".to_string(),
            color: "#EC4899".to_string(),
        },
    ]
}

fn get_symlink_agents() -> Vec<AgentConfig> {
    get_agent_configs()
        .into_iter()
        .filter(|a| a.compatibility == "symlink")
        .collect()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillInfo {
    pub name: String,
    pub description: String,
    #[serde(rename = "descriptionZh")]
    pub description_zh: Option<String>,
    #[serde(rename = "descriptionEn")]
    pub description_en: Option<String>,
    pub path: String,
    pub paths: Vec<String>,
    #[serde(rename = "skillType")]
    pub skill_type: String,
    pub version: Option<String>,
    pub author: Option<String>,
    pub source: Option<String>,  // "marketplace" | "github" | "local"
    #[serde(rename = "sourceUrl")]
    pub source_url: Option<String>,
    #[serde(rename = "installDate")]
    pub install_date: Option<u64>,
    #[serde(rename = "commitHash")]
    pub commit_hash: Option<String>,
}

// Skill 元数据 - 存储在每个 skill 目录的 .skill-meta.json
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SkillMetadata {
    pub source: String,  // "marketplace" | "github" | "local"
    #[serde(rename = "sourceUrl")]
    pub source_url: Option<String>,
    #[serde(rename = "installDate")]
    pub install_date: u64,
    #[serde(rename = "commitHash")]
    pub commit_hash: Option<String>,
    pub version: Option<String>,
    pub author: Option<String>,
    pub description: Option<String>,
    #[serde(rename = "descriptionZh")]
    pub description_zh: Option<String>,
    #[serde(rename = "descriptionEn")]
    pub description_en: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ScanResult {
    #[serde(rename = "systemSkills")]
    pub system_skills: Vec<SkillInfo>,
    #[serde(rename = "projectSkills")]
    pub project_skills: Vec<SkillInfo>,
}

#[derive(Debug, Deserialize)]
pub struct ImportGithubRequest {
    #[serde(rename = "repoUrl")]
    pub repo_url: String,
    #[serde(rename = "installPath")]
    pub install_path: Option<String>,
    #[serde(rename = "skipSecurityCheck")]
    pub skip_security_check: bool,
    // Expected skill name (for mono-repo skill discovery)
    #[serde(rename = "skillName")]
    pub skill_name: Option<String>,
    // 市场元数据（从市场安装时传入）
    #[serde(rename = "isMarketplace")]
    pub is_marketplace: Option<bool>,
    pub description: Option<String>,
    #[serde(rename = "descriptionZh")]
    pub description_zh: Option<String>,
    #[serde(rename = "descriptionEn")]
    pub description_en: Option<String>,
    pub author: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub success: bool,
    pub message: String,
    pub blocked: bool,
}

#[derive(Debug, Deserialize)]
pub struct UninstallRequest {
    #[serde(rename = "skillPaths")]
    pub skill_paths: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CheckExistsRequest {
    #[serde(rename = "skillName")]
    pub skill_name: String,
    #[serde(rename = "installPath")]
    pub install_path: String,
}

#[derive(Debug, Serialize)]
pub struct CheckExistsResult {
    pub exists: bool,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportLocalRequest {
    #[serde(rename = "sourcePath")]
    pub source_path: String,
    #[serde(rename = "installPath")]
    pub install_path: Option<String>,
    #[serde(rename = "skillName")]
    pub skill_name: String,
}

#[derive(Debug, Deserialize)]
pub struct SavePathsRequest {
    pub paths: Vec<String>,
}

fn get_claude_skills_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(PRIMARY_SKILLS_DIR))
}

/// Expand `~` prefix in a path to the actual home directory.
/// Rust's PathBuf does NOT expand `~` automatically, so any path
/// received from the frontend must be expanded before use.
fn expand_tilde(path: &str) -> PathBuf {
    if path.starts_with("~/") || path == "~" {
        if let Some(home) = dirs::home_dir() {
            return home.join(&path[2..]);
        }
    }
    PathBuf::from(path)
}

fn get_config_path() -> Option<PathBuf> {
    let new_path = get_custom_data_dir().ok().map(|d| d.join("config.json"));
    let old_path = dirs::home_dir().map(|h| h.join(".claude").join("skill-manager-config.json"));

    // Auto-migrate: if old path exists but new path does not, copy then remove
    if let (Some(ref new), Some(ref old)) = (&new_path, &old_path) {
        if old.exists() && !new.exists() {
            if let Ok(content) = fs::read_to_string(old) {
                if fs::write(new, &content).is_ok() {
                    let _ = fs::remove_file(old);
                    eprintln!("[config] Migrated {} -> {}", old.display(), new.display());
                }
            }
        }
    }

    // Prefer new path; fall back to old path if new doesn't exist yet
    match &new_path {
        Some(p) if p.exists() => new_path,
        _ => match &old_path {
            Some(p) if p.exists() => old_path,
            _ => new_path, // neither exists, use new path for creation
        }
    }
}

// 从 SKILL.md 中提取版本号
fn extract_version_from_md(content: &str) -> Option<String> {
    // 尝试匹配常见的版本格式
    // 例如: "Version: 1.0.0", "v1.0.0", "**Version**: 1.0.0"
    for line in content.lines() {
        let line_lower = line.to_lowercase();
        if line_lower.contains("version") {
            // 提取版本号
            if let Some(version) = extract_version_number(line) {
                return Some(version);
            }
        }
    }
    None
}

fn extract_version_number(text: &str) -> Option<String> {
    // 匹配 v1.0.0 或 1.0.0 格式
    let re_patterns = [
        r"v?(\d+\.\d+\.\d+)",
        r"v?(\d+\.\d+)",
    ];
    for pattern in re_patterns {
        if let Ok(re) = regex::Regex::new(pattern) {
            if let Some(caps) = re.captures(text) {
                if let Some(m) = caps.get(1) {
                    return Some(m.as_str().to_string());
                }
            }
        }
    }
    None
}

// 从 SKILL.md 中提取作者
fn extract_author_from_md(content: &str) -> Option<String> {
    for line in content.lines() {
        let line_lower = line.to_lowercase();
        if line_lower.contains("author") {
            // 提取 : 或 **: 后面的内容
            if let Some(pos) = line.find(':') {
                let author = line[pos + 1..].trim();
                let author = author.trim_matches(|c| c == '*' || c == '`');
                if !author.is_empty() {
                    return Some(author.to_string());
                }
            }
        }
    }
    None
}

// 加载 skill 元数据
fn load_skill_metadata(skill_dir: &PathBuf) -> Option<SkillMetadata> {
    let meta_path = skill_dir.join(".skill-meta.json");
    if meta_path.exists() {
        if let Ok(content) = fs::read_to_string(&meta_path) {
            return serde_json::from_str(&content).ok();
        }
    }
    None
}

// 保存 skill 元数据
fn save_skill_metadata(skill_dir: &PathBuf, metadata: &SkillMetadata) -> Result<(), String> {
    let meta_path = skill_dir.join(".skill-meta.json");
    let content = serde_json::to_string_pretty(metadata)
        .map_err(|e| format!("Failed to serialize metadata: {}", e))?;
    fs::write(&meta_path, content)
        .map_err(|e| format!("Failed to write metadata: {}", e))?;
    Ok(())
}

// 获取当前时间戳
fn current_timestamp() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

// 解析 YAML frontmatter，返回 (description, name, version)
fn parse_yaml_frontmatter(content: &str) -> (Option<String>, Option<String>, Option<String>) {
    let lines: Vec<&str> = content.lines().collect();

    // 检查是否以 --- 开头
    if lines.is_empty() || lines[0].trim() != "---" {
        return (None, None, None);
    }

    // 找到结束的 ---
    let mut end_index = None;
    for (i, line) in lines.iter().enumerate().skip(1) {
        if line.trim() == "---" {
            end_index = Some(i);
            break;
        }
    }

    let end_index = match end_index {
        Some(i) => i,
        None => return (None, None, None),
    };

    // 解析 frontmatter 中的字段
    let mut description = None;
    let mut name = None;
    let mut version = None;

    let frontmatter_lines = &lines[1..end_index];
    let mut i = 0;
    while i < frontmatter_lines.len() {
        let line = frontmatter_lines[i].trim();

        // 解析 description 字段
        if line.starts_with("description:") {
            let value = line.trim_start_matches("description:").trim();
            // 移除引号
            let value = value.trim_matches('"').trim_matches('\'');
            // 处理 YAML 多行标记符 | 或 >
            if value == "|" || value == ">" || value == "|+" || value == "|-" || value == ">+" || value == ">-" {
                // 收集后续缩进行作为多行描述
                let mut multi_lines: Vec<String> = Vec::new();
                i += 1;
                while i < frontmatter_lines.len() {
                    let next = frontmatter_lines[i];
                    if next.starts_with(' ') || next.starts_with('\t') {
                        multi_lines.push(next.trim().to_string());
                        i += 1;
                    } else {
                        break;
                    }
                }
                let joined = multi_lines.join(" ");
                if !joined.is_empty() {
                    description = Some(joined);
                }
                continue;
            } else if !value.is_empty() {
                description = Some(value.to_string());
            }
        }

        // 解析 name 字段
        if line.starts_with("name:") {
            let value = line.trim_start_matches("name:").trim();
            let value = value.trim_matches('"').trim_matches('\'');
            if !value.is_empty() {
                name = Some(value.to_string());
            }
        }

        // 解析 version 字段
        if line.starts_with("version:") {
            let value = line.trim_start_matches("version:").trim();
            let value = value.trim_matches('"').trim_matches('\'');
            if !value.is_empty() {
                version = Some(value.to_string());
            }
        }

        i += 1;
    }

    (description, name, version)
}

fn parse_skill_md(path: &PathBuf, skill_type: &str) -> Option<SkillInfo> {
    let content = fs::read_to_string(path).ok()?;
    let skill_dir = path.parent()?;
    let name = skill_dir.file_name()?.to_string_lossy().to_string();

    // 尝试解析 YAML frontmatter
    let (frontmatter_desc, frontmatter_name, frontmatter_version) = parse_yaml_frontmatter(&content);

    // 如果没有 frontmatter，使用旧方法提取描述
    let description = frontmatter_desc.unwrap_or_else(|| {
        let mut lines = content.lines();
        
        // 如果以 --- 开头，跳过整个 frontmatter 块
        if content.starts_with("---") {
            // 跳过第一个 ---
            lines.next(); 
            // 跳过直到下一个 ---
            for line in &mut lines {
                if line.trim() == "---" {
                    break;
                }
            }
        }

        lines
            .skip_while(|l| l.starts_with('#') || l.trim().is_empty())
            .take_while(|l| !l.trim().is_empty() && !l.starts_with('#'))
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(500)
            .collect::<String>()
    });

    // 使用 frontmatter 中的 name，如果没有则使用目录名
    let skill_name = frontmatter_name.unwrap_or(name);

    // 从 SKILL.md 提取版本和作者
    let version_from_md = frontmatter_version.or_else(|| extract_version_from_md(&content));
    let author_from_md = extract_author_from_md(&content);

    // 尝试加载元数据
    let metadata = load_skill_metadata(&skill_dir.to_path_buf());

    // 优先使用元数据中的描述（从市场安装时保存的中英文描述）
    let (desc_zh, desc_en) = if let Some(ref m) = metadata {
        (m.description_zh.clone(), m.description_en.clone())
    } else {
        (None, None)
    };

    let dir_path = skill_dir.to_string_lossy().to_string();
    Some(SkillInfo {
        name: skill_name,
        description: description.clone(),
        description_zh: desc_zh.or_else(|| Some(description.clone())),
        description_en: desc_en.or_else(|| Some(description)),
        path: dir_path.clone(),
        paths: vec![dir_path],
        skill_type: skill_type.to_string(),
        version: version_from_md.or_else(|| metadata.as_ref().and_then(|m| m.version.clone())),
        author: author_from_md.or_else(|| metadata.as_ref().and_then(|m| m.author.clone())),
        source: metadata.as_ref().map(|m| m.source.clone()),
        source_url: metadata.as_ref().and_then(|m| m.source_url.clone()),
        install_date: metadata.as_ref().map(|m| m.install_date).or_else(|| {
            // Fallback: use SKILL.md file's mtime when no .skill-meta.json exists
            fs::metadata(path).ok()
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as u64)
        }),
        commit_hash: metadata.as_ref().and_then(|m| m.commit_hash.clone()),
    })
}

fn aggregate_skills(skills: Vec<SkillInfo>) -> Vec<SkillInfo> {
    use std::collections::HashMap;
    // Key by (name, source_url) so same-name skills from different repos stay separate,
    // while same-name same-source skills (multi-path installs) get merged.
    let mut map: HashMap<(String, Option<String>), SkillInfo> = HashMap::new();
    for skill in skills {
        let key = (
            skill.name.clone(),
            skill.source.as_ref().and_then(|_| skill.source_url.clone()),
        );
        map.entry(key)
            .and_modify(|existing| {
                for p in &skill.paths {
                    if !existing.paths.contains(p) {
                        existing.paths.push(p.clone());
                    }
                }
            })
            .or_insert(skill);
    }
    map.into_values().collect()
}

#[tauri::command]
fn scan_skills() -> Result<ScanResult, String> {
    let mut system_skills = Vec::new();
    let mut project_skills = Vec::new();

    if let Some(skills_dir) = get_claude_skills_dir() {
        if skills_dir.exists() {
            for entry in WalkDir::new(&skills_dir).max_depth(3) {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.file_name().map(|n| is_skill_md(n)).unwrap_or(false) {
                        if let Some(skill) = parse_skill_md(&path.to_path_buf(), "system") {
                            system_skills.push(skill);
                        }
                    }
                }
            }
        }
    }

    if let Ok(paths) = get_project_paths() {
        for project_path in paths {
            let skills_dir = expand_tilde(&project_path);
            if skills_dir.exists() {
                for entry in WalkDir::new(&skills_dir).max_depth(3) {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.file_name().map(|n| is_skill_md(n)).unwrap_or(false) {
                            if let Some(skill) = parse_skill_md(&path.to_path_buf(), "project") {
                                project_skills.push(skill);
                            }
                        }
                    }
                }
            }
        }
    }

    let system_skills = aggregate_skills(system_skills);
    let project_skills = aggregate_skills(project_skills);

    Ok(ScanResult {
        system_skills,
        project_skills,
    })
}

// 解析 GitHub URL，提取仓库基础地址、分支名、子路径和 skill 名称
struct ParsedGithubUrl {
    repo_base: String,
    branch: String,
    subpath: String,
    skill_name: String,
    has_subpath: bool,
}

// --- Custom Sources ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SourceStatus {
    Synced,
    Syncing,
    Error,
    Pending,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomSource {
    pub id: String,
    pub url: String,
    pub owner: String,
    pub repo: String,
    pub subpath: String,
    pub branch: String,
    #[serde(rename = "addedAt")]
    pub added_at: u64,
    #[serde(rename = "lastSyncAt")]
    pub last_sync_at: u64,
    #[serde(rename = "lastCommitHash")]
    pub last_commit_hash: String,
    #[serde(rename = "skillCount")]
    pub skill_count: usize,
    pub status: SourceStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomMarketplaceSkill {
    pub id: String,
    pub name: String,
    pub author: String,
    #[serde(rename = "authorAvatar")]
    pub author_avatar: String,
    pub description: String,
    #[serde(rename = "githubUrl")]
    pub github_url: String,
    pub stars: u64,
    pub forks: u64,
    #[serde(rename = "updatedAt")]
    pub updated_at: u64,
    pub path: String,
    pub branch: String,
    #[serde(rename = "sourceId")]
    pub source_id: String,
}

fn get_custom_data_dir() -> Result<PathBuf, String> {
    let base = dirs::data_dir()
        .ok_or_else(|| "Cannot determine data directory".to_string())?;
    let dir = base.join("skills-manager");
    if !dir.exists() {
        fs::create_dir_all(&dir).map_err(|e| format!("Failed to create data dir: {}", e))?;
    }
    Ok(dir)
}

/// Detect the actual default branch of a cloned repo via `git symbolic-ref`.
fn detect_default_branch(repo_dir: &std::path::Path) -> Option<String> {
    Command::new("git")
        .current_dir(repo_dir)
        .args(["symbolic-ref", "--short", "HEAD"])
        .output()
        .ok()
        .and_then(|o| if o.status.success() {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        } else { None })
}

fn parse_github_url(url: &str) -> Result<ParsedGithubUrl, String> {
    let url = url.trim_end_matches('/');

    if !url.starts_with("http") {
        return Err("Invalid URL".to_string());
    }

    if let Some(tree_idx) = url.find("/tree/") {
        let repo_base = url[..tree_idx].to_string();
        let after_tree = &url[tree_idx + 6..]; // skip "/tree/"
        let parts: Vec<&str> = after_tree.splitn(2, '/').collect();
        let branch = parts[0].to_string();
        let subpath = if parts.len() > 1 { parts[1].to_string() } else { String::new() };
        let skill_name = if subpath.is_empty() {
            // tree/branch 但没有子路径，用仓库名
            repo_base.rsplit('/').next().unwrap_or("skill").to_string()
        } else {
            subpath.rsplit('/').next().unwrap_or("skill").to_string()
        };

        // 验证 repo_base 至少有 owner/repo
        let base_parts: Vec<&str> = repo_base.split('/').collect();
        if base_parts.len() < 5 {
            return Err("Invalid GitHub URL: missing owner/repo".to_string());
        }

        Ok(ParsedGithubUrl {
            repo_base,
            branch,
            subpath,
            skill_name,
            has_subpath: true,
        })
    } else {
        let parts: Vec<&str> = url.split('/').collect();
        if parts.len() < 5 {
            return Err("Invalid GitHub URL".to_string());
        }
        let skill_name = parts[4].to_string();
        Ok(ParsedGithubUrl {
            repo_base: url.to_string(),
            branch: String::new(),
            subpath: String::new(),
            skill_name,
            has_subpath: false,
        })
    }
}

#[tauri::command(async)]
async fn import_github_skill(request: ImportGithubRequest) -> Result<ImportResult, String> {
    let repo_url = request.repo_url.clone();

    let result = tokio::task::spawn_blocking(move || {
        let parsed = match parse_github_url(&repo_url) {
            Ok(p) => p,
            Err(msg) => return ImportResult {
                success: false,
                message: msg,
                blocked: false,
            },
        };

        // 确定安装目录
        let install_dir = if let Some(path) = &request.install_path {
            expand_tilde(path)
        } else {
            match get_claude_skills_dir() {
                Some(dir) => dir,
                None => return ImportResult {
                    success: false,
                    message: "Cannot determine skills directory".to_string(),
                    blocked: false,
                },
            }
        };

        if let Err(e) = fs::create_dir_all(&install_dir) {
            return ImportResult {
                success: false,
                message: format!("Failed to create directory: {}", e),
                blocked: false,
            };
        }

        let mut target_dir = install_dir.join(&parsed.skill_name);

        if parsed.has_subpath && !parsed.subpath.is_empty() {
            let branch = if parsed.branch.is_empty() { "main".to_string() } else { parsed.branch.clone() };
            let subpath = parsed.subpath.clone();

            let temp_dir = install_dir.join(".temp_clone");
            let _ = fs::remove_dir_all(&temp_dir);

            let output = Command::new("git")
                .args(["clone", "--depth", "1", "--filter=blob:none", "--sparse", &parsed.repo_base, temp_dir.to_str().unwrap()])
                .output();

            match output {
                Err(e) => return ImportResult {
                    success: false,
                    message: format!("Git command failed: {}", e),
                    blocked: false,
                },
                Ok(o) if !o.status.success() => return ImportResult {
                    success: false,
                    message: format!("Git clone failed: {}", String::from_utf8_lossy(&o.stderr)),
                    blocked: false,
                },
                _ => {}
            }

            let sparse_output = Command::new("git")
                .current_dir(&temp_dir)
                .args(["sparse-checkout", "set", &subpath])
                .output();

            match sparse_output {
                Err(e) => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Sparse checkout failed: {}", e),
                        blocked: false,
                    };
                },
                Ok(o) if !o.status.success() => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Sparse checkout failed: {}", String::from_utf8_lossy(&o.stderr)),
                        blocked: false,
                    };
                },
                _ => {}
            }

            let checkout_output = Command::new("git")
                .current_dir(&temp_dir)
                .args(["checkout", &branch])
                .output();

            match checkout_output {
                Err(e) => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Git checkout failed: {}", e),
                        blocked: false,
                    };
                },
                Ok(o) if !o.status.success() => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Git checkout failed: {}", String::from_utf8_lossy(&o.stderr)),
                        blocked: false,
                    };
                },
                _ => {}
            }

            let source = temp_dir.join(&subpath);
            if source.exists() {
                let _ = fs::remove_dir_all(&target_dir);
                if let Err(e) = fs::rename(&source, &target_dir) {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Failed to move skill: {}", e),
                        blocked: false,
                    };
                }

                // 保存元数据 (sparse checkout)
                let metadata = SkillMetadata {
                    source: "github".to_string(),
                    source_url: Some(request.repo_url.clone()),
                    install_date: current_timestamp(),
                    commit_hash: None,  // sparse checkout 不保留 git 信息
                    version: None,
                    author: None,
                    description: None,
                    description_zh: None,
                    description_en: None,
                };
                let _ = save_skill_metadata(&target_dir, &metadata);
            } else {
                let _ = fs::remove_dir_all(&temp_dir);
                return ImportResult {
                    success: false,
                    message: format!("Sparse checkout failed: source path not found ({})", subpath),
                    blocked: false,
                };
            }

            let _ = fs::remove_dir_all(&temp_dir);
        } else {
            // Single lightweight clone: tree metadata only (~KB), then selective checkout
            let expected_name = request.skill_name.as_deref().unwrap_or(&parsed.skill_name);
            let temp_dir = install_dir.join(format!(".tmp-tree-{}", parsed.skill_name));
            let _ = fs::remove_dir_all(&temp_dir);

            let temp_path = temp_dir.to_str().unwrap_or_default();
            let tree_clone = Command::new("git")
                .args(["clone", "--depth", "1", "--filter=blob:none", "--no-checkout",
                       &parsed.repo_base, temp_path])
                .output();

            match tree_clone {
                Err(e) => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Git clone failed: {}", e),
                        blocked: false,
                    };
                }
                Ok(o) if !o.status.success() => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Git clone failed: {}", String::from_utf8_lossy(&o.stderr)),
                        blocked: false,
                    };
                }
                _ => {}
            }

            // List all file paths to locate SKILL.md (no blob content downloaded)
            let ls_output = Command::new("git")
                .current_dir(&temp_dir)
                .args(["ls-tree", "-r", "--name-only", "HEAD"])
                .output();

            let tree_listing = match ls_output {
                Ok(out) if out.status.success() => String::from_utf8_lossy(&out.stdout).to_string(),
                _ => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: "Failed to list repository contents".to_string(),
                        blocked: false,
                    };
                }
            };

            // Determine SKILL.md location: root vs subdirectory
            let has_root_skill = tree_listing.lines().any(|l| ends_with_skill_md(l) && !l.contains('/'));
            let subpath_skill = if !has_root_skill {
                // Try both SKILL.md and skill.md variants
                let mut found = None;
                for variant in SKILL_MD_VARIANTS {
                    let pattern = format!("{}/{}", expected_name, variant);
                    if let Some(line) = tree_listing.lines().find(|line| line.ends_with(&pattern)) {
                        found = Some(trim_skill_md_suffix(line).to_string());
                        break;
                    }
                }
                found
            } else {
                None
            };

            if has_root_skill {
                // Normal repo: checkout all content (blobs fetched lazily on demand)
                let co = Command::new("git")
                    .current_dir(&temp_dir)
                    .args(["checkout"])
                    .output();

                match co {
                    Err(e) => {
                        let _ = fs::remove_dir_all(&temp_dir);
                        return ImportResult {
                            success: false,
                            message: format!("Git checkout failed: {}", e),
                            blocked: false,
                        };
                    }
                    Ok(o) if !o.status.success() => {
                        let _ = fs::remove_dir_all(&temp_dir);
                        return ImportResult {
                            success: false,
                            message: format!("Git checkout failed: {}", String::from_utf8_lossy(&o.stderr)),
                            blocked: false,
                        };
                    }
                    _ => {}
                }

                // Move to target_dir
                let _ = fs::remove_dir_all(&target_dir);
                if let Err(e) = fs::rename(&temp_dir, &target_dir) {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Failed to move skill directory: {}", e),
                        blocked: false,
                    };
                }
                // Clean up .git directory from installed skill
                let _ = fs::remove_dir_all(target_dir.join(".git"));
            } else if let Some(subpath) = subpath_skill {
                // Mono-repo: sparse checkout only the skill subdirectory
                let sc = Command::new("git")
                    .current_dir(&temp_dir)
                    .args(["sparse-checkout", "set", &subpath])
                    .output();

                match sc {
                    Err(e) => {
                        let _ = fs::remove_dir_all(&temp_dir);
                        return ImportResult {
                            success: false,
                            message: format!("Sparse checkout failed: {}", e),
                            blocked: false,
                        };
                    }
                    Ok(o) if !o.status.success() => {
                        let _ = fs::remove_dir_all(&temp_dir);
                        return ImportResult {
                            success: false,
                            message: format!("Sparse checkout failed: {}", String::from_utf8_lossy(&o.stderr)),
                            blocked: false,
                        };
                    }
                    _ => {}
                }

                let co = Command::new("git")
                    .current_dir(&temp_dir)
                    .args(["checkout"])
                    .output();

                match co {
                    Err(e) => {
                        let _ = fs::remove_dir_all(&temp_dir);
                        return ImportResult {
                            success: false,
                            message: format!("Git checkout failed: {}", e),
                            blocked: false,
                        };
                    }
                    Ok(o) if !o.status.success() => {
                        let _ = fs::remove_dir_all(&temp_dir);
                        return ImportResult {
                            success: false,
                            message: format!("Git checkout failed: {}", String::from_utf8_lossy(&o.stderr)),
                            blocked: false,
                        };
                    }
                    _ => {}
                }

                let source_dir = temp_dir.join(&subpath);
                if !source_dir.exists() {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Sparse checkout succeeded but skill directory not found at '{}'", subpath),
                        blocked: false,
                    };
                }

                // Get commit hash before moving
                let commit_hash = Command::new("git")
                    .current_dir(&temp_dir)
                    .args(["rev-parse", "HEAD"])
                    .output()
                    .ok()
                    .and_then(|o| if o.status.success() {
                        Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                    } else { None });

                // Move skill subdirectory to final install location
                let final_dir = install_dir.join(expected_name);
                let _ = fs::remove_dir_all(&final_dir);
                if let Err(e) = fs::rename(&source_dir, &final_dir) {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return ImportResult {
                        success: false,
                        message: format!("Failed to move skill directory: {}", e),
                        blocked: false,
                    };
                }
                let _ = fs::remove_dir_all(&temp_dir);
                target_dir = final_dir;

                // Save metadata with full marketplace info
                let metadata = SkillMetadata {
                    source: "github".to_string(),
                    source_url: Some(request.repo_url.clone()),
                    install_date: current_timestamp(),
                    commit_hash,
                    version: request.version.clone(),
                    author: request.author.clone(),
                    description: request.description.clone(),
                    description_zh: request.description_zh.clone(),
                    description_en: request.description_en.clone(),
                };
                let _ = save_skill_metadata(&target_dir, &metadata);

                return ImportResult {
                    success: true,
                    message: format!("Successfully installed {} from mono-repo to {}", expected_name, target_dir.display()),
                    blocked: false,
                };
            } else {
                // SKILL.md not found anywhere
                let _ = fs::remove_dir_all(&temp_dir);
                return ImportResult {
                    success: false,
                    message: format!(
                        "Skill '{}' not found in repository '{}'. Please provide the direct GitHub URL with the path to the skill directory (e.g. .../tree/main/path/to/{}).",
                        expected_name, parsed.repo_base, expected_name
                    ),
                    blocked: false,
                };
            }
        }

        // 获取 commit hash
        let commit_hash = Command::new("git")
            .current_dir(&target_dir)
            .args(["rev-parse", "HEAD"])
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    Some(String::from_utf8_lossy(&o.stdout).trim().to_string())
                } else {
                    None
                }
            });

        // 保存元数据
        let metadata = SkillMetadata {
            source: "github".to_string(),
            source_url: Some(request.repo_url.clone()),
            install_date: current_timestamp(),
            commit_hash,
            version: None,  // 会从 SKILL.md 中提取
            author: None,   // 会从 SKILL.md 中提取
            description: None,
            description_zh: None,
            description_en: None,
        };
        let _ = save_skill_metadata(&target_dir, &metadata);

        ImportResult {
            success: true,
            message: format!("Successfully installed {} to {}", parsed.skill_name, target_dir.display()),
            blocked: false,
        }
    }).await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
fn check_skill_exists(request: CheckExistsRequest) -> Result<CheckExistsResult, String> {
    let install_dir = PathBuf::from(&request.install_path);
    let target = install_dir.join(&request.skill_name);
    let exists = target.exists() && find_skill_md(&target).is_some();
    Ok(CheckExistsResult {
        exists,
        path: target.to_string_lossy().to_string(),
    })
}

#[tauri::command]
fn uninstall_skill(request: UninstallRequest) -> Result<ImportResult, String> {
    if request.skill_paths.is_empty() {
        return Ok(ImportResult {
            success: false,
            message: "No skill paths provided".to_string(),
            blocked: false,
        });
    }

    let mut deleted = 0;
    let mut errors = Vec::new();

    for skill_path in &request.skill_paths {
        if skill_path.is_empty() {
            continue;
        }
        let path = PathBuf::from(skill_path);
        if !path.exists() {
            errors.push(format!("Path does not exist: {}", skill_path));
            continue;
        }
        let path_str = path.to_string_lossy().to_string();
        if !path_str.contains("skills") {
            errors.push(format!("Invalid path (not in skills dir): {}", skill_path));
            continue;
        }
        match fs::remove_dir_all(&path) {
            Ok(_) => deleted += 1,
            Err(e) => errors.push(format!("{}: {}", skill_path, e)),
        }
    }

    if deleted > 0 && errors.is_empty() {
        Ok(ImportResult {
            success: true,
            message: format!("Successfully deleted {} path(s)", deleted),
            blocked: false,
        })
    } else if deleted > 0 {
        Ok(ImportResult {
            success: true,
            message: format!("Deleted {} path(s), errors: {}", deleted, errors.join("; ")),
            blocked: false,
        })
    } else {
        Ok(ImportResult {
            success: false,
            message: format!("Failed to delete: {}", errors.join("; ")),
            blocked: false,
        })
    }
}

#[tauri::command]
fn import_local_skill(request: ImportLocalRequest) -> Result<ImportResult, String> {
    let source = PathBuf::from(&request.source_path);

    if !source.exists() {
        return Ok(ImportResult {
            success: false,
            message: "Source path does not exist".to_string(),
            blocked: false,
        });
    }

    let install_dir = if let Some(path) = &request.install_path {
        PathBuf::from(path)
    } else {
        get_claude_skills_dir().ok_or("Cannot determine skills directory")?
    };

    fs::create_dir_all(&install_dir).map_err(|e| e.to_string())?;

    let target_dir = install_dir.join(&request.skill_name);

    copy_dir_all(&source, &target_dir).map_err(|e| e.to_string())?;

    // 保存本地导入的元数据
    let metadata = SkillMetadata {
        source: "local".to_string(),
        source_url: None,
        install_date: current_timestamp(),
        commit_hash: None,
        version: None,
        author: None,
        description: None,
        description_zh: None,
        description_en: None,
    };
    let _ = save_skill_metadata(&target_dir, &metadata);

    Ok(ImportResult {
        success: true,
        message: format!("Successfully imported {} to {}", request.skill_name, target_dir.display()),
        blocked: false,
    })
}

fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}

#[tauri::command]
fn get_project_paths() -> Result<Vec<String>, String> {
    let config_path = get_config_path().ok_or("Cannot determine config path")?;

    if !config_path.exists() {
        return Ok(Vec::new());
    }

    let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
    let config: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let paths = config
        .get("projectPaths")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    Ok(paths)
}

#[tauri::command]
fn save_project_paths(request: SavePathsRequest) -> Result<(), String> {
    let config_path = get_config_path().ok_or("Cannot determine config path")?;

    if let Some(parent) = config_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let mut config: serde_json::Value = if config_path.exists() {
        let content = fs::read_to_string(&config_path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    config["projectPaths"] = serde_json::json!(request.paths);

    fs::write(&config_path, serde_json::to_string_pretty(&config).unwrap())
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(["/c", "start", "", &url])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_skill(skill_path: String) -> Result<String, String> {
    let path = PathBuf::from(&skill_path);
    if let Some(skill_md) = find_skill_md(&path) {
        fs::read_to_string(&skill_md).map_err(|e| e.to_string())
    } else {
        Err("SKILL.md not found".to_string())
    }
}

#[derive(Debug, Deserialize)]
pub struct SecurityScanRequest {
    #[serde(rename = "skillPath")]
    pub skill_path: String,
    #[serde(rename = "skillId")]
    pub skill_id: String,
}

#[tauri::command]
fn scan_skill_security(request: SecurityScanRequest) -> Result<SecurityReport, String> {
    let path = PathBuf::from(&request.skill_path);

    if !path.exists() {
        return Err(format!("Skill path does not exist: {}", request.skill_path));
    }

    security::scan_directory(&path, &request.skill_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn scan_all_skills_security() -> Result<Vec<SecurityReport>, String> {
    let mut reports = Vec::new();

    if let Some(skills_dir) = get_claude_skills_dir() {
        if skills_dir.exists() {
            for entry in WalkDir::new(&skills_dir).max_depth(2) {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if path.is_dir() && path.join("SKILL.md").exists() {
                        let skill_id = path.file_name()
                            .map(|n| n.to_string_lossy().to_string())
                            .unwrap_or_else(|| "unknown".to_string());

                        if let Ok(report) = security::scan_directory(path, &skill_id) {
                            reports.push(report);
                        }
                    }
                }
            }
        }
    }

    if let Ok(paths) = get_project_paths() {
        for project_path in paths {
            let skills_dir = PathBuf::from(&project_path).join(".claude").join("skills");
            if skills_dir.exists() {
                for entry in WalkDir::new(&skills_dir).max_depth(2) {
                    if let Ok(entry) = entry {
                        let path = entry.path();
                        if path.is_dir() && find_skill_md(path).is_some() {
                            let skill_id = path.file_name()
                                .map(|n| n.to_string_lossy().to_string())
                                .unwrap_or_else(|| "unknown".to_string());

                            if let Ok(report) = security::scan_directory(path, &skill_id) {
                                reports.push(report);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(reports)
}

// ========== 软链接管理 ==========

#[tauri::command]
fn get_all_agents() -> Result<Vec<AgentConfig>, String> {
    Ok(get_agent_configs())
}

#[tauri::command]
fn get_symlink_agents_config() -> Result<Vec<AgentConfig>, String> {
    Ok(get_symlink_agents())
}

// 检查所有软链接状态
#[tauri::command]
fn check_symlink_status() -> Result<Vec<SymlinkStatus>, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let source_dir = home.join(PRIMARY_SKILLS_DIR);
    let agents = get_symlink_agents();
    let mut statuses = Vec::new();

    for agent in agents {
        let link_path = home.join(&agent.global_skills_dir);

        let status = if link_path.exists() {
            // 检查是否是有效的符号链接
            match fs::read_link(&link_path) {
                Ok(target) => {
                    let is_valid = target == source_dir ||
                        target.to_string_lossy().contains(".claude/skills");
                    SymlinkStatus {
                        agent_id: agent.id.clone(),
                        agent_name: agent.display_name.clone(),
                        target_path: source_dir.to_string_lossy().to_string(),
                        link_path: link_path.to_string_lossy().to_string(),
                        exists: true,
                        is_valid,
                        error: if is_valid { None } else {
                            Some(format!("Points to: {}", target.display()))
                        },
                    }
                }
                Err(_) => {
                    // 存在但不是符号链接（可能是普通目录）
                    SymlinkStatus {
                        agent_id: agent.id.clone(),
                        agent_name: agent.display_name.clone(),
                        target_path: source_dir.to_string_lossy().to_string(),
                        link_path: link_path.to_string_lossy().to_string(),
                        exists: true,
                        is_valid: false,
                        error: Some("Path exists but is not a symlink".to_string()),
                    }
                }
            }
        } else {
            SymlinkStatus {
                agent_id: agent.id.clone(),
                agent_name: agent.display_name.clone(),
                target_path: source_dir.to_string_lossy().to_string(),
                link_path: link_path.to_string_lossy().to_string(),
                exists: false,
                is_valid: false,
                error: None,
            }
        };

        statuses.push(status);
    }

    Ok(statuses)
}

// 创建单个软链接
#[tauri::command]
fn create_symlink(agent_id: String) -> Result<SymlinkStatus, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;
    let source_dir = home.join(PRIMARY_SKILLS_DIR);

    let agents = get_symlink_agents();
    let agent = agents.iter()
        .find(|a| a.id == agent_id)
        .ok_or("Agent not found")?;

    let link_path = home.join(&agent.global_skills_dir);

    // 确保源目录存在
    if !source_dir.exists() {
        fs::create_dir_all(&source_dir).map_err(|e| e.to_string())?;
    }

    // 确保链接父目录存在
    if let Some(parent) = link_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    // 如果路径已存在，检查是否是符号链接
    if link_path.exists() || link_path.is_symlink() {
        match fs::read_link(&link_path) {
            Ok(target) => {
                // 检查是否是合法的目标
                let is_valid = target == source_dir || target.to_string_lossy().contains(".claude/skills");
                if is_valid {
                    // 如果已经是合法的，先删除旧的
                    let _ = fs::remove_file(&link_path);
                } else {
                    // 冲突：已链接到其他目录
                    return Ok(SymlinkStatus {
                        agent_id: agent.id.clone(),
                        agent_name: agent.display_name.clone(),
                        target_path: source_dir.to_string_lossy().to_string(),
                        link_path: link_path.to_string_lossy().to_string(),
                        exists: true,
                        is_valid: false,
                        error: Some(format!("Conflict: already linked to {}", target.display())),
                    });
                }
            }
            Err(_) => {
                // 存在但不是符号链接
                return Ok(SymlinkStatus {
                    agent_id: agent.id.clone(),
                    agent_name: agent.display_name.clone(),
                    target_path: source_dir.to_string_lossy().to_string(),
                    link_path: link_path.to_string_lossy().to_string(),
                    exists: true,
                    is_valid: false,
                    error: Some("Path exists and is not a symlink. Please remove it manually.".to_string()),
                });
            }
        }
    }

    // 创建符号链接
    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&source_dir, &link_path)
            .map_err(|e| e.to_string())?;
    }

    #[cfg(windows)]
    {
        // Windows 需要管理员权限或开发者模式
        std::os::windows::fs::symlink_dir(&source_dir, &link_path)
            .map_err(|e| format!("Failed to create symlink (may need admin rights): {}", e))?;
    }

    Ok(SymlinkStatus {
        agent_id: agent.id.clone(),
        agent_name: agent.display_name.clone(),
        target_path: source_dir.to_string_lossy().to_string(),
        link_path: link_path.to_string_lossy().to_string(),
        exists: true,
        is_valid: true,
        error: None,
    })
}

// 创建所有软链接
#[tauri::command]
fn create_all_symlinks() -> Result<Vec<SymlinkStatus>, String> {
    let agents = get_symlink_agents();
    let mut results = Vec::new();

    for agent in agents {
        match create_symlink(agent.id.clone()) {
            Ok(status) => results.push(status),
            Err(e) => results.push(SymlinkStatus {
                agent_id: agent.id.clone(),
                agent_name: agent.display_name.clone(),
                target_path: "".to_string(),
                link_path: "".to_string(),
                exists: false,
                is_valid: false,
                error: Some(e),
            }),
        }
    }

    Ok(results)
}

// 删除软链接
#[tauri::command]
fn remove_symlink(agent_id: String) -> Result<SymlinkStatus, String> {
    let home = dirs::home_dir().ok_or("Cannot determine home directory")?;

    let agents = get_symlink_agents();
    let agent = agents.iter()
        .find(|a| a.id == agent_id)
        .ok_or("Agent not found")?;

    let link_path = home.join(&agent.global_skills_dir);

    if link_path.exists() {
        let metadata = fs::symlink_metadata(&link_path).map_err(|e| e.to_string())?;
        if metadata.file_type().is_symlink() {
            fs::remove_file(&link_path).map_err(|e| e.to_string())?;
        } else {
            return Err("Path is not a symlink, refusing to remove".to_string());
        }
    }

    Ok(SymlinkStatus {
        agent_id: agent.id.clone(),
        agent_name: agent.display_name.clone(),
        target_path: "".to_string(),
        link_path: link_path.to_string_lossy().to_string(),
        exists: false,
        is_valid: false,
        error: None,
    })
}

// 获取平台信息
#[tauri::command]
fn get_platform_info() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "os": std::env::consts::OS,
        "arch": std::env::consts::ARCH,
        "family": std::env::consts::FAMILY,
    }))
}


#[derive(Debug, Serialize, Clone)]
pub struct DiscoveredSkill {
    pub name: String,
    pub path: String, // Relative path in repo
    pub description: String,
    pub exists: bool, // Whether a skill with the same name already exists
}

#[derive(Debug, Deserialize)]
pub struct AnalyzeRequest {
    #[serde(rename = "repoUrl")]
    pub repo_url: String,
}

#[derive(Debug, Serialize)]
pub struct AnalyzeResult {
    pub success: bool,
    pub message: String,
    pub skills: Vec<DiscoveredSkill>,
    #[serde(rename = "tempPath")]
    pub temp_path: String, // Path to temp clone for subsequent import
}

#[derive(Debug, Deserialize)]
pub struct AnalyzeLocalRequest {
    #[serde(rename = "sourcePath")]
    pub source_path: String,
}

#[tauri::command(async)]
async fn analyze_local_folder(request: AnalyzeLocalRequest) -> Result<AnalyzeResult, String> {
    let source_path = PathBuf::from(request.source_path);
    
    let result = tokio::task::spawn_blocking(move || {
        if !source_path.exists() {
             return AnalyzeResult {
                success: false,
                message: "Source directory not found".to_string(),
                skills: vec![],
                temp_path: "".to_string(),
            };
        }

        // Scan for SKILL.md
        let skills_dir = get_claude_skills_dir();
        let mut discovered_skills = Vec::new();
        for entry in WalkDir::new(&source_path).max_depth(5) {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.file_name().map(|n| is_skill_md(n)).unwrap_or(false) {
                    if let Some(skill_info) = parse_skill_md(&path.to_path_buf(), "local") {
                        // Calculate relative path
                        let relative_path = path.parent().unwrap().strip_prefix(&source_path).unwrap_or(path.parent().unwrap());
                        let already_exists = skills_dir.as_ref().map_or(false, |dir| dir.join(&skill_info.name).exists());
                        
                        discovered_skills.push(DiscoveredSkill {
                            name: skill_info.name,
                            path: relative_path.to_string_lossy().to_string(),
                            description: skill_info.description,
                            exists: already_exists,
                        });
                    }
                }
            }
        }

        AnalyzeResult {
            success: true,
            message: "Local analysis complete".to_string(),
            skills: discovered_skills,
            temp_path: source_path.to_string_lossy().to_string(),
        }
    }).await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command(async)]
async fn analyze_github_repo(request: AnalyzeRequest) -> Result<AnalyzeResult, String> {
    let repo_url = request.repo_url.clone();
    
    let result = tokio::task::spawn_blocking(move || {
        let parsed = match parse_github_url(&repo_url) {
            Ok(p) => p,
            Err(msg) => return AnalyzeResult {
                success: false,
                message: msg,
                skills: vec![],
                temp_path: "".to_string(),
            },
        };

        let skills_dir = match get_claude_skills_dir() {
            Some(dir) => dir,
            None => return AnalyzeResult {
                success: false,
                message: "Cannot determine skills directory".to_string(),
                skills: vec![],
                temp_path: "".to_string(),
            },
        };

        // Create temp directory
        let timestamp = current_timestamp();
        let temp_dir_name = format!(".temp_import_{}", timestamp);
        let temp_dir = skills_dir.join(&temp_dir_name);

        if let Err(e) = fs::create_dir_all(&temp_dir) {
            return AnalyzeResult {
                success: false,
                message: format!("Failed to create temp directory: {}", e),
                skills: vec![],
                temp_path: "".to_string(),
            };
        }

        // 根据是否有子路径选择克隆策略
        if parsed.has_subpath && !parsed.subpath.is_empty() {
            let branch = if parsed.branch.is_empty() { "main".to_string() } else { parsed.branch.clone() };

            // Sparse checkout: 仅下载子路径内容
            let output = Command::new("git")
                .args(["clone", "--depth", "1", "--filter=blob:none", "--sparse", &parsed.repo_base, temp_dir.to_str().unwrap()])
                .output();

            match output {
                Err(e) => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return AnalyzeResult {
                        success: false,
                        message: format!("Git command failed: {}", e),
                        skills: vec![],
                        temp_path: "".to_string(),
                    };
                },
                Ok(o) if !o.status.success() => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return AnalyzeResult {
                        success: false,
                        message: format!("Git clone failed: {}", String::from_utf8_lossy(&o.stderr)),
                        skills: vec![],
                        temp_path: "".to_string(),
                    };
                },
                _ => {}
            }

            let sparse_output = Command::new("git")
                .current_dir(&temp_dir)
                .args(["sparse-checkout", "set", &parsed.subpath])
                .output();

            match sparse_output {
                Err(e) => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return AnalyzeResult {
                        success: false,
                        message: format!("Sparse checkout failed: {}", e),
                        skills: vec![],
                        temp_path: "".to_string(),
                    };
                },
                Ok(o) if !o.status.success() => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return AnalyzeResult {
                        success: false,
                        message: format!("Sparse checkout failed: {}", String::from_utf8_lossy(&o.stderr)),
                        skills: vec![],
                        temp_path: "".to_string(),
                    };
                },
                _ => {}
            }

            let checkout_output = Command::new("git")
                .current_dir(&temp_dir)
                .args(["checkout", &branch])
                .output();

            match checkout_output {
                Err(e) => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return AnalyzeResult {
                        success: false,
                        message: format!("Git checkout failed: {}", e),
                        skills: vec![],
                        temp_path: "".to_string(),
                    };
                },
                Ok(o) if !o.status.success() => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return AnalyzeResult {
                        success: false,
                        message: format!("Git checkout failed: {}", String::from_utf8_lossy(&o.stderr)),
                        skills: vec![],
                        temp_path: "".to_string(),
                    };
                },
                _ => {}
            }

            // 验证子路径目录存在
            let subpath_dir = temp_dir.join(&parsed.subpath);
            if !subpath_dir.exists() {
                let _ = fs::remove_dir_all(&temp_dir);
                return AnalyzeResult {
                    success: false,
                    message: format!("Subpath not found in repository: {}", parsed.subpath),
                    skills: vec![],
                    temp_path: "".to_string(),
                };
            }
        } else {
            // 普通 clone
            let clone_url = if parsed.has_subpath {
                // tree/branch 但没有子路径
                &parsed.repo_base
            } else {
                &parsed.repo_base
            };

            let output = Command::new("git")
                .args(["clone", "--depth", "1", clone_url, temp_dir.to_str().unwrap()])
                .output();

            match output {
                Err(e) => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return AnalyzeResult {
                        success: false,
                        message: format!("Git command failed: {}", e),
                        skills: vec![],
                        temp_path: "".to_string(),
                    };
                },
                Ok(o) if !o.status.success() => {
                    let _ = fs::remove_dir_all(&temp_dir);
                    return AnalyzeResult {
                        success: false,
                        message: format!("Git clone failed: {}", String::from_utf8_lossy(&o.stderr)),
                        skills: vec![],
                        temp_path: "".to_string(),
                    };
                },
                _ => {}
            }
        }

        // 确定扫描的根目录：如果有子路径，只扫描子路径目录
        let scan_root = if parsed.has_subpath && !parsed.subpath.is_empty() {
            temp_dir.join(&parsed.subpath)
        } else {
            temp_dir.clone()
        };

        // Scan for SKILL.md
        let skills_dir_check = get_claude_skills_dir();
        let mut discovered_skills = Vec::new();
        for entry in WalkDir::new(&scan_root).max_depth(5) {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.file_name().map(|n| n == "SKILL.md").unwrap_or(false) {
                    if let Some(skill_info) = parse_skill_md(&path.to_path_buf(), "temp") {
                        // Calculate relative path from temp_dir (not scan_root)
                        let relative_path = path.parent().unwrap().strip_prefix(&temp_dir).unwrap_or(path.parent().unwrap());
                        let already_exists = skills_dir_check.as_ref().map_or(false, |dir| dir.join(&skill_info.name).exists());
                        
                        discovered_skills.push(DiscoveredSkill {
                            name: skill_info.name,
                            path: relative_path.to_string_lossy().to_string(),
                            description: skill_info.description,
                            exists: already_exists,
                        });
                    }
                }
            }
        }

        AnalyzeResult {
            success: true,
            message: "Analysis complete".to_string(),
            skills: discovered_skills,
            temp_path: temp_dir.to_string_lossy().to_string(),
        }
    }).await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[derive(Debug, Deserialize)]
pub struct InstallSelectedRequest {
    #[serde(rename = "tempPath")]
    pub temp_path: String,
    #[serde(rename = "selectedPaths")]
    pub selected_paths: Vec<String>, // Relative paths of skills to install
    #[serde(rename = "repoUrl")]
    pub repo_url: String,
    #[serde(rename = "installPath")]
    pub install_path: Option<String>,
}

#[tauri::command(async)]
async fn import_selected_skills(request: InstallSelectedRequest) -> Result<ImportResult, String> {
    let temp_path = expand_tilde(&request.temp_path);
    let skills_dir = if let Some(ref path) = request.install_path {
        let p = expand_tilde(path);
        if let Err(e) = fs::create_dir_all(&p) {
            return Ok(ImportResult {
                success: false,
                message: format!("Failed to create install directory: {}", e),
                blocked: false,
            });
        }
        p
    } else {
        get_claude_skills_dir().ok_or("Cannot determine skills directory")?
    };

    eprintln!("[import_selected_skills] temp_path={}, skills_dir={}, selected_paths={:?}",
        temp_path.display(), skills_dir.display(), request.selected_paths);
    
    let result = tokio::task::spawn_blocking(move || {
        if !temp_path.exists() {
             return ImportResult {
                success: false,
                message: format!("Temporary import directory not found: {}", temp_path.display()),
                blocked: false,
            };
        }

        let mut success_count = 0;
        let mut errors: Vec<String> = Vec::new();

        for rel_path in request.selected_paths {
            let source_dir = if rel_path.is_empty() {
                temp_path.clone()
            } else {
                temp_path.join(&rel_path)
            };
            
            // 从目录名获取 skill 名称
            let mut skill_name = source_dir.file_name().unwrap_or_default().to_string_lossy().to_string();
            
            // 如果文件夹名是临时目录或为空，从 SKILL.md 解析真实名称
            if skill_name.is_empty() || skill_name.starts_with(".temp_import") {
                if let Some(skill_md_path) = find_skill_md(&source_dir) {
                    if let Ok(content) = fs::read_to_string(&skill_md_path) {
                        let (_, parsed_name, _) = parse_yaml_frontmatter(&content);
                        if let Some(name) = parsed_name {
                            skill_name = name;
                        } else {
                            // Fallback: 从仓库 URL 提取名称
                            let url = &request.repo_url;
                            if let Some(last_segment) = url.trim_end_matches('/').rsplit('/').next() {
                                let clean = last_segment.to_lowercase().replace(' ', "-");
                                if !clean.is_empty() {
                                    skill_name = clean;
                                }
                            }
                        }
                    }
                }
            }
            
            let target_dir = skills_dir.join(&skill_name);

            eprintln!("[import_selected_skills] rel_path={}, source={}, target={}, source_exists={}",
                rel_path, source_dir.display(), target_dir.display(), source_dir.exists());

            if !source_dir.exists() {
                errors.push(format!("Source not found: {}", rel_path));
                continue;
            }

            // If target exists, remove to overwrite
            if target_dir.exists() {
                let _ = fs::remove_dir_all(&target_dir);
            }

            // Move directory (rename), fallback to copy
            if let Err(rename_err) = fs::rename(&source_dir, &target_dir) {
                eprintln!("[import_selected_skills] rename failed: {}, trying copy", rename_err);
                if let Err(copy_err) = copy_dir_all(&source_dir, &target_dir) {
                    eprintln!("[import_selected_skills] copy also failed: {}", copy_err);
                    errors.push(format!("{}: copy failed: {}", skill_name, copy_err));
                    continue;
                }
            }

             // Add metadata
            let metadata = SkillMetadata {
                source: "github".to_string(),
                source_url: Some(request.repo_url.clone()),
                install_date: current_timestamp(),
                commit_hash: None,
                version: None,
                author: None,
                description: None,
                description_zh: None,
                description_en: None,
            };
            let _ = save_skill_metadata(&target_dir, &metadata);
            
            success_count += 1;
        }

        // Cleanup temp dir
        let _ = fs::remove_dir_all(&temp_path);

        if errors.is_empty() {
            ImportResult {
                success: true,
                message: format!("Imported {} skills", success_count),
                blocked: false,
            }
        } else {
            ImportResult {
                success: success_count > 0,
                message: format!("Imported {} skills, {} errors: {}", success_count, errors.len(), errors.join("; ")),
                blocked: false,
            }
        }
    }).await.map_err(|e| e.to_string())?;

    Ok(result)
}

#[tauri::command]
async fn cleanup_temp_import(temp_path: String) -> Result<(), String> {
    let path = PathBuf::from(&temp_path);
    if !path.exists() {
        return Ok(());
    }
    // Safety: only delete directories that match .temp_import_ prefix
    let dir_name = path.file_name().unwrap_or_default().to_string_lossy();
    if !dir_name.starts_with(".temp_import_") {
        return Err("Refusing to delete non-temp directory".to_string());
    }
    fs::remove_dir_all(&path).map_err(|e| format!("Failed to cleanup: {}", e))?;
    Ok(())
}

// --- Custom Sources: Storage Helpers ---

fn load_custom_sources() -> Result<Vec<CustomSource>, String> {
    let dir = get_custom_data_dir()?;
    let path = dir.join("custom-sources.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read custom-sources.json: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse custom-sources.json: {}", e))
}

fn save_custom_sources(sources: &[CustomSource]) -> Result<(), String> {
    let dir = get_custom_data_dir()?;
    let path = dir.join("custom-sources.json");
    let content = serde_json::to_string_pretty(sources)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write custom-sources.json: {}", e))
}

fn load_custom_marketplace() -> Result<Vec<CustomMarketplaceSkill>, String> {
    let dir = get_custom_data_dir()?;
    let path = dir.join("custom-marketplace.json");
    if !path.exists() {
        return Ok(vec![]);
    }
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read custom-marketplace.json: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse custom-marketplace.json: {}", e))
}

fn save_custom_marketplace(skills: &[CustomMarketplaceSkill]) -> Result<(), String> {
    let dir = get_custom_data_dir()?;
    let path = dir.join("custom-marketplace.json");
    let content = serde_json::to_string_pretty(skills)
        .map_err(|e| format!("Failed to serialize: {}", e))?;
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write custom-marketplace.json: {}", e))
}

fn extract_owner_repo(url: &str) -> Result<(String, String), String> {
    let url = url.trim_end_matches('/');
    let parts: Vec<&str> = url.split('/').collect();
    // https://github.com/owner/repo or with /tree/...
    if parts.len() < 5 {
        return Err("Cannot extract owner/repo from URL".to_string());
    }
    Ok((parts[3].to_string(), parts[4].to_string()))
}

fn generate_source_id() -> String {
    format!("{:x}", current_timestamp())
}

// T1.2: add_custom_source
#[tauri::command(async)]
async fn add_custom_source(url: String) -> Result<CustomSource, String> {
    let url_clone = url.clone();

    let result = tokio::task::spawn_blocking(move || {
        let parsed = parse_github_url(&url_clone)?;
        let (owner, repo) = extract_owner_repo(&url_clone)?;

        // Check duplicate
        let existing = load_custom_sources()?;
        if existing.iter().any(|s| s.owner == owner && s.repo == repo && s.subpath == parsed.subpath) {
            return Err("Source already exists".to_string());
        }

        let data_dir = get_custom_data_dir()?;
        let temp_dir = data_dir.join(format!(".temp_scan_{}", current_timestamp()));
        fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create temp dir: {}", e))?;

        // Clone repo
        let mut branch = if parsed.branch.is_empty() { "main".to_string() } else { parsed.branch.clone() };
        if parsed.has_subpath && !parsed.subpath.is_empty() {
            let output = Command::new("git")
                .args(["clone", "--depth", "1", "--filter=blob:none", "--sparse",
                       &parsed.repo_base, temp_dir.to_str().unwrap()])
                .output()
                .map_err(|e| format!("Git failed: {}", e))?;
            if !output.status.success() {
                let _ = fs::remove_dir_all(&temp_dir);
                return Err(format!("Git clone failed: {}", String::from_utf8_lossy(&output.stderr)));
            }
            // Detect actual default branch from cloned repo
            if parsed.branch.is_empty() {
                if let Some(b) = detect_default_branch(&temp_dir) { branch = b; }
            }
            let sparse = Command::new("git")
                .current_dir(&temp_dir)
                .args(["sparse-checkout", "set", &parsed.subpath])
                .output()
                .map_err(|e| format!("Sparse checkout failed: {}", e))?;
            if !sparse.status.success() {
                let _ = fs::remove_dir_all(&temp_dir);
                return Err(format!("Sparse checkout failed: {}", String::from_utf8_lossy(&sparse.stderr)));
            }
            let co = Command::new("git")
                .current_dir(&temp_dir)
                .args(["checkout", &branch])
                .output()
                .map_err(|e| format!("Checkout failed: {}", e))?;
            if !co.status.success() {
                let _ = fs::remove_dir_all(&temp_dir);
                return Err(format!("Checkout failed: {}", String::from_utf8_lossy(&co.stderr)));
            }
        } else {
            let output = Command::new("git")
                .args(["clone", "--depth", "1", &parsed.repo_base, temp_dir.to_str().unwrap()])
                .output()
                .map_err(|e| format!("Git failed: {}", e))?;
            if !output.status.success() {
                let _ = fs::remove_dir_all(&temp_dir);
                return Err(format!("Git clone failed: {}", String::from_utf8_lossy(&output.stderr)));
            }
            // Detect actual default branch from cloned repo
            if parsed.branch.is_empty() {
                if let Some(b) = detect_default_branch(&temp_dir) { branch = b; }
            }
        }

        // Get commit hash
        let hash_output = Command::new("git")
            .current_dir(&temp_dir)
            .args(["rev-parse", "HEAD"])
            .output()
            .map_err(|e| format!("Git rev-parse failed: {}", e))?;
        let commit_hash = String::from_utf8_lossy(&hash_output.stdout).trim().to_string();

        // Scan for SKILL.md
        let scan_root = if parsed.has_subpath && !parsed.subpath.is_empty() {
            temp_dir.join(&parsed.subpath)
        } else {
            temp_dir.clone()
        };

        let mut discovered: Vec<CustomMarketplaceSkill> = Vec::new();
        let source_id = generate_source_id();
        for entry in WalkDir::new(&scan_root).max_depth(5) {
            if let Ok(entry) = entry {
                let path = entry.path();
                if path.file_name().map(|n| n == "SKILL.md").unwrap_or(false) {
                    if let Some(skill_info) = parse_skill_md(&path.to_path_buf(), "custom") {
                        let relative_path = path.parent().unwrap()
                            .strip_prefix(&temp_dir).unwrap_or(path.parent().unwrap());
                        discovered.push(CustomMarketplaceSkill {
                            id: format!("{}/{}/{}", owner, repo, skill_info.name),
                            name: skill_info.name,
                            author: owner.clone(),
                            author_avatar: format!("https://github.com/{}.png", owner),
                            description: skill_info.description,
                            github_url: format!("https://github.com/{}/{}/tree/{}/{}",
                                owner, repo, branch, relative_path.to_string_lossy()),
                            stars: 0,
                            forks: 0,
                            updated_at: current_timestamp(),
                            path: relative_path.to_string_lossy().to_string(),
                            branch: branch.clone(),
                            source_id: source_id.clone(),
                        });
                    }
                }
            }
        }

        // Cleanup temp clone
        let _ = fs::remove_dir_all(&temp_dir);

        // Fetch GitHub metadata via curl (avoid reqwest::blocking + tokio conflict)
        let api_url = format!("https://api.github.com/repos/{}/{}", owner, repo);
        let (stars, forks) = {
            let curl_output = Command::new("curl")
                .args(["-s", "-H", "Accept: application/vnd.github.v3+json", &api_url])
                .output();
            match curl_output {
                Ok(output) if output.status.success() => {
                    let body = String::from_utf8_lossy(&output.stdout);
                    if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                        let s = json.get("stargazers_count").and_then(|v| v.as_u64()).unwrap_or(0);
                        let f = json.get("forks_count").and_then(|v| v.as_u64()).unwrap_or(0);
                        (s, f)
                    } else {
                        (0u64, 0u64)
                    }
                }
                _ => (0u64, 0u64),
            }
        };

        // Update stars/forks in discovered skills
        for skill in discovered.iter_mut() {
            skill.stars = stars;
            skill.forks = forks;
        }

        let now = current_timestamp();
        let source = CustomSource {
            id: source_id,
            url: url_clone,
            owner,
            repo,
            subpath: parsed.subpath,
            branch,
            added_at: now,
            last_sync_at: now,
            last_commit_hash: commit_hash,
            skill_count: discovered.len(),
            status: SourceStatus::Synced,
        };

        // Save — re-check uniqueness and deduplicate before writing
        let mut sources = load_custom_sources()?;
        let src_owner = source.owner.clone();
        let src_repo = source.repo.clone();
        let src_subpath = source.subpath.clone();
        sources.retain(|s| !(s.owner == src_owner && s.repo == src_repo && s.subpath == src_subpath));
        sources.push(source.clone());
        save_custom_sources(&sources)?;

        let mut marketplace = load_custom_marketplace()?;
        // Clean old marketplace skills belonging to the replaced source (if any)
        marketplace.retain(|s| !(s.author == src_owner && discovered.iter().any(|d| d.name == s.name && d.source_id != s.source_id)));
        marketplace.extend(discovered);
        save_custom_marketplace(&marketplace)?;

        Ok(source)
    }).await.map_err(|e| e.to_string())?;

    result
}

// T1.3: get_custom_sources + get_custom_marketplace
#[tauri::command(async)]
async fn get_custom_sources() -> Result<Vec<CustomSource>, String> {
    load_custom_sources()
}

#[tauri::command(async)]
async fn get_custom_marketplace() -> Result<Vec<CustomMarketplaceSkill>, String> {
    load_custom_marketplace()
}

// T1.4: remove_custom_source
#[tauri::command(async)]
async fn remove_custom_source(id: String) -> Result<(), String> {
    let mut sources = load_custom_sources()?;
    sources.retain(|s| s.id != id);
    save_custom_sources(&sources)?;

    let mut marketplace = load_custom_marketplace()?;
    marketplace.retain(|s| s.source_id != id);
    save_custom_marketplace(&marketplace)?;

    Ok(())
}

// T1.5: refresh_custom_source
#[tauri::command(async)]
async fn refresh_custom_source(id: Option<String>) -> Result<Vec<CustomSource>, String> {
    let sources = load_custom_sources()?;
    let targets: Vec<&CustomSource> = match &id {
        Some(id) => sources.iter().filter(|s| s.id == *id).collect(),
        None => sources.iter().collect(),
    };

    let mut updated_ids: Vec<String> = Vec::new();

    for source in targets {
        let repo_url = format!("https://github.com/{}/{}", source.owner, source.repo);
        let hash_check = Command::new("git")
            .args(["ls-remote", &repo_url, "HEAD"])
            .output();

        if let Ok(output) = hash_check {
            let remote_line = String::from_utf8_lossy(&output.stdout);
            let remote_hash = remote_line.split_whitespace().next().unwrap_or("").to_string();
            if !remote_hash.is_empty() && remote_hash != source.last_commit_hash {
                // Atomic re-index: remove first, then add once
                let url = source.url.clone();
                let old_id = source.id.clone();
                let backup = source.clone();
                let _ = remove_custom_source(old_id.clone()).await;
                match add_custom_source(url).await {
                    Ok(_) => {
                        updated_ids.push(old_id);
                    }
                    Err(e) => {
                        eprintln!("[refresh_custom_source] re-add failed for {}: {}, restoring backup", old_id, e);
                        // Restore the old source to prevent data loss
                        if let Ok(mut srcs) = load_custom_sources() {
                            srcs.push(backup);
                            let _ = save_custom_sources(&srcs);
                        }
                    }
                }
            }
        }
    }

    // Always update last_sync_at for all targeted sources, even if no new commits
    let mut final_sources = load_custom_sources()?;
    let now = current_timestamp();
    let target_ids: Vec<String> = match &id {
        Some(id) => vec![id.clone()],
        None => final_sources.iter().map(|s| s.id.clone()).collect(),
    };
    for source in final_sources.iter_mut() {
        if target_ids.contains(&source.id) {
            source.last_sync_at = now;
        }
    }
    save_custom_sources(&final_sources)?;

    Ok(final_sources)
}

// skills.sh search proxy — bypasses CORS restriction in webview
#[tauri::command(async)]
async fn search_skills_sh(query: String) -> Result<serde_json::Value, String> {
    let result = tokio::task::spawn_blocking(move || {
        let url = format!("https://skills.sh/api/search?q={}&limit=50", urlencoding(&query));
        let ua = detect_chrome_ua();
        let output = Command::new("curl")
            .args([
                "-s", "-m", "10",
                "-H", &format!("User-Agent: {}", ua),
                "-H", "Accept: application/json",
                &url,
            ])
            .output()
            .map_err(|e| format!("curl failed: {}", e))?;

        if !output.status.success() {
            return Err(format!("curl returned status: {}", output.status));
        }

        let body = String::from_utf8_lossy(&output.stdout);
        serde_json::from_str::<serde_json::Value>(&body)
            .map_err(|e| format!("JSON parse error: {}", e))
    }).await.map_err(|e| e.to_string())??;

    Ok(result)
}

/// Detect installed Chrome version; fallback to a reasonable default.
/// Result is cached with OnceLock — only detects once per process lifetime.
fn detect_chrome_ua() -> &'static str {
    use std::sync::OnceLock;
    static UA: OnceLock<String> = OnceLock::new();
    UA.get_or_init(|| {
        #[cfg(target_os = "windows")]
        let platform = "Windows NT 10.0; Win64; x64";
        #[cfg(target_os = "macos")]
        let platform = "Macintosh; Intel Mac OS X 10_15_7";
        #[cfg(target_os = "linux")]
        let platform = "X11; Linux x86_64";
        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        let platform = "Macintosh; Intel Mac OS X 10_15_7";

        match get_chrome_version() {
            Some(v) if !v.is_empty() => {
                format!("Mozilla/5.0 ({}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/{} Safari/537.36", platform, v)
            }
            _ => format!("Mozilla/5.0 ({}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36", platform),
        }
    })
}

fn get_chrome_version() -> Option<String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("defaults")
            .args(["read", "/Applications/Google Chrome.app/Contents/Info", "CFBundleShortVersionString"])
            .output()
            .ok()
            .and_then(|o| if o.status.success() { Some(String::from_utf8_lossy(&o.stdout).trim().to_string()) } else { None })
    }

    #[cfg(target_os = "windows")]
    {
        // Read from Windows registry: HKLM\SOFTWARE\Google\Chrome\BLBeacon\version
        Command::new("reg")
            .args(["query", r"HKLM\SOFTWARE\Google\Chrome\BLBeacon", "/v", "version"])
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    let out = String::from_utf8_lossy(&o.stdout);
                    // Output format: "    version    REG_SZ    131.0.6778.265"
                    out.lines()
                        .find(|l| l.contains("version"))
                        .and_then(|l| l.split_whitespace().last())
                        .map(|v| v.trim().to_string())
                } else {
                    None
                }
            })
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("google-chrome")
            .arg("--version")
            .output()
            .ok()
            .and_then(|o| {
                if o.status.success() {
                    let out = String::from_utf8_lossy(&o.stdout);
                    // Output: "Google Chrome 131.0.6778.265"
                    out.split_whitespace().last().map(|v| v.trim().to_string())
                } else {
                    None
                }
            })
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

// Simple percent-encoding for URL query parameters
fn urlencoding(input: &str) -> String {
    let mut result = String::with_capacity(input.len() * 3);
    for byte in input.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(byte as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", byte));
            }
        }
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_skills,
            import_github_skill,
            uninstall_skill,
            check_skill_exists,
            import_local_skill,
            save_project_paths,
            get_project_paths,
            analyze_github_repo,
            analyze_local_folder,
            import_selected_skills,
            open_url,
            read_skill,
            scan_skill_security,
            scan_all_skills_security,
            get_all_agents,
            get_symlink_agents_config,
            check_symlink_status,
            create_symlink,
            create_all_symlinks,
            remove_symlink,
            get_platform_info,
            cleanup_temp_import,
            add_custom_source,
            get_custom_sources,
            get_custom_marketplace,
            remove_custom_source,
            refresh_custom_source,
            search_skills_sh
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}


