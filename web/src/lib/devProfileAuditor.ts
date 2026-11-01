export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  email: string | null;
  bio: string | null;
  twitter_username: string | null;
  public_repos: number;
  public_gists: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  fork: boolean;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  pushed_at: string;
  has_issues: boolean;
  open_issues_count: number;
  license: { key: string; name: string } | null;
}

export interface ProofOfWorkAuditResult {
  username: string;
  user: GitHubUser;
  totalScore: number; // 0 - 100
  tier: 'Elite Builder' | 'Strong Contributor' | 'Active Developer' | 'Emerging Dev';
  breakdown: {
    profileCompleteness: { score: number; max: 15; notes: string[] };
    repoStarsForks: { score: number; max: 25; notes: string[] };
    languagesDiversity: { score: number; max: 20; notes: string[]; languages: { name: string; count: number }[] };
    recentActivity: { score: number; max: 20; notes: string[]; daysSinceLastPush: number };
    documentationHygiene: { score: number; max: 20; notes: string[] };
  };
  keyStats: {
    totalStars: number;
    totalForks: number;
    originalReposCount: number;
    forkedReposCount: number;
    accountAgeYears: number;
  };
  recommendations: string[];
}

export async function auditGitHubProfile(username: string): Promise<ProofOfWorkAuditResult> {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) {
    throw new Error('Please enter a valid GitHub username.');
  }

  // 1. Fetch user details
  const userRes = await fetch(`https://api.github.com/users/${cleanUsername}`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  if (!userRes.ok) {
    if (userRes.status === 404) {
      throw new Error(`GitHub user "${cleanUsername}" was not found.`);
    }
    if (userRes.status === 403) {
      throw new Error('GitHub API rate limit reached. Please wait a moment and try again.');
    }
    throw new Error(`Failed to fetch user data: ${userRes.statusText}`);
  }

  const user: GitHubUser = await userRes.json();

  // 2. Fetch repos (up to 100 recent repos)
  const reposRes = await fetch(`https://api.github.com/users/${cleanUsername}/repos?sort=updated&per_page=100`, {
    headers: { Accept: 'application/vnd.github.v3+json' },
  });

  let repos: GitHubRepo[] = [];
  if (reposRes.ok) {
    repos = await reposRes.json();
  }

  // Calculation heuristics
  // 1. Profile completeness (15 pts)
  let profileScore = 0;
  const profileNotes: string[] = [];
  if (user.avatar_url) { profileScore += 3; profileNotes.push('Avatar configured (+3)'); }
  if (user.bio && user.bio.trim().length > 10) { profileScore += 4; profileNotes.push('Detailed bio (+4)'); }
  if (user.location) { profileScore += 3; profileNotes.push(`Location set: ${user.location} (+3)`); }
  if (user.company) { profileScore += 2; profileNotes.push(`Company set: ${user.company} (+2)`); }
  if (user.blog) { profileScore += 3; profileNotes.push('Portfolio/Blog link verified (+3)'); }

  // 2. Public repositories & stars/forks count (25 pts)
  let repoScore = 0;
  const repoNotes: string[] = [];
  const originalRepos = repos.filter(r => !r.fork);
  let totalStars = 0;
  let totalForks = 0;
  for (const r of originalRepos) {
    totalStars += r.stargazers_count || 0;
    totalForks += r.forks_count || 0;
  }

  // Original repos volume
  if (originalRepos.length >= 15) { repoScore += 8; repoNotes.push('Strong repository portfolio (15+ original repos, +8)'); }
  else if (originalRepos.length >= 5) { repoScore += 6; repoNotes.push('Solid repository portfolio (5+ repos, +6)'); }
  else if (originalRepos.length >= 1) { repoScore += 3; repoNotes.push('Has active public repos (+3)'); }

  // Stars earned
  if (totalStars >= 50) { repoScore += 10; repoNotes.push(`Significant open-source stars (${totalStars} stars, +10)`); }
  else if (totalStars >= 10) { repoScore += 7; repoNotes.push(`Community traction (${totalStars} stars, +7)`); }
  else if (totalStars >= 1) { repoScore += 4; repoNotes.push(`Has GitHub stars (${totalStars} stars, +4)`); }

  // Forks earned
  if (totalForks >= 15) { repoScore += 7; repoNotes.push(`Community forks (${totalForks} forks, +7)`); }
  else if (totalForks >= 3) { repoScore += 4; repoNotes.push(`Has code forks (${totalForks} forks, +4)`); }
  else if (totalForks >= 1) { repoScore += 2; repoNotes.push(`Repo forked by peers (+2)`); }
  repoScore = Math.min(25, repoScore);

  // 3. Languages diversity (20 pts)
  const langCountMap: Record<string, number> = {};
  for (const r of originalRepos) {
    if (r.language) {
      langCountMap[r.language] = (langCountMap[r.language] || 0) + 1;
    }
  }
  const languagesList = Object.entries(langCountMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  let langScore = 0;
  const langNotes: string[] = [];
  const distinctLangs = languagesList.length;
  if (distinctLangs >= 4) {
    langScore = 20;
    langNotes.push(`High polyglot versatility (${distinctLangs} languages across repos, +20)`);
  } else if (distinctLangs >= 2) {
    langScore = 15;
    langNotes.push(`Multi-stack developer (${distinctLangs} languages, +15)`);
  } else if (distinctLangs === 1) {
    langScore = 10;
    langNotes.push(`Specialized focus in ${languagesList[0].name} (+10)`);
  } else {
    langScore = 5;
    langNotes.push('No primary languages detected (+5)');
  }

  // 4. Recent activity & recency of pushed code (20 pts)
  let activityScore = 0;
  const activityNotes: string[] = [];
  let daysSinceLastPush = 999;
  if (repos.length > 0) {
    const latestPush = repos.reduce((latest, r) => {
      const pTime = new Date(r.pushed_at).getTime();
      return pTime > latest ? pTime : latest;
    }, 0);

    if (latestPush > 0) {
      daysSinceLastPush = Math.max(0, Math.floor((Date.now() - latestPush) / (1000 * 60 * 60 * 24)));
    }
  }

  if (daysSinceLastPush <= 7) {
    activityScore = 20;
    activityNotes.push('Super active! Code pushed within the last 7 days (+20)');
  } else if (daysSinceLastPush <= 30) {
    activityScore = 16;
    activityNotes.push(`Consistently active: pushed code ${daysSinceLastPush} days ago (+16)`);
  } else if (daysSinceLastPush <= 90) {
    activityScore = 11;
    activityNotes.push(`Active this quarter: last push ${daysSinceLastPush} days ago (+11)`);
  } else {
    activityScore = 5;
    activityNotes.push(`Stale activity: last push ${daysSinceLastPush} days ago (+5)`);
  }

  // 5. Readme presence & documentation hygiene (20 pts)
  let docScore = 0;
  const docNotes: string[] = [];
  const reposWithDesc = originalRepos.filter(r => r.description && r.description.trim().length > 10).length;
  const reposWithLicense = originalRepos.filter(r => r.license !== null).length;

  if (reposWithDesc >= 8) { docScore += 8; docNotes.push('High description coverage on repositories (+8)'); }
  else if (reposWithDesc >= 3) { docScore += 5; docNotes.push('Good repo descriptions provided (+5)'); }
  else if (reposWithDesc >= 1) { docScore += 2; docNotes.push('Some repo descriptions provided (+2)'); }

  if (reposWithLicense >= 3) { docScore += 6; docNotes.push('Open-source licenses properly attached (+6)'); }
  else if (reposWithLicense >= 1) { docScore += 3; docNotes.push('License included on key repos (+3)'); }

  // Account maturity
  const createdDate = new Date(user.created_at);
  const accountAgeYears = Math.max(0, Math.round(((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 365)) * 10) / 10);
  if (accountAgeYears >= 3) { docScore += 6; docNotes.push(`Veteran GitHub account (${accountAgeYears} years, +6)`); }
  else if (accountAgeYears >= 1) { docScore += 4; docNotes.push(`Established GitHub account (${accountAgeYears} years, +4)`); }
  else { docScore += 2; docNotes.push(`Recent account profile (+2)`); }
  docScore = Math.min(20, docScore);

  const totalScore = profileScore + repoScore + langScore + activityScore + docScore;

  let tier: ProofOfWorkAuditResult['tier'] = 'Emerging Dev';
  if (totalScore >= 80) tier = 'Elite Builder';
  else if (totalScore >= 65) tier = 'Strong Contributor';
  else if (totalScore >= 45) tier = 'Active Developer';

  // Actionable tips
  const recommendations: string[] = [];
  if (!user.bio) recommendations.push('Add an impactful GitHub bio highlighting your target tech stack and engineering philosophy.');
  if (!user.blog) recommendations.push('Link your personal portfolio, LinkedIn profile, or tech blog in your GitHub profile settings.');
  if (daysSinceLastPush > 14) recommendations.push('Commit and push regularly — recruiters value active green commit streaks.');
  if (reposWithDesc < originalRepos.length) recommendations.push('Write concise 1-2 sentence descriptions for all public repositories to help recruiters understand their scope instantly.');
  if (reposWithLicense === 0 && originalRepos.length > 0) recommendations.push('Add open-source licenses (MIT/Apache 2.0) to your repositories to demonstrate production-grade hygiene.');
  if (languagesList.length < 2) recommendations.push('Showcase polyglot proficiency by deploying projects using complementary languages (e.g. TypeScript + Go or Python).');

  return {
    username: cleanUsername,
    user,
    totalScore,
    tier,
    breakdown: {
      profileCompleteness: { score: profileScore, max: 15, notes: profileNotes },
      repoStarsForks: { score: repoScore, max: 25, notes: repoNotes },
      languagesDiversity: { score: langScore, max: 20, notes: langNotes, languages: languagesList },
      recentActivity: { score: activityScore, max: 20, notes: activityNotes, daysSinceLastPush },
      documentationHygiene: { score: docScore, max: 20, notes: docNotes },
    },
    keyStats: {
      totalStars,
      totalForks,
      originalReposCount: originalRepos.length,
      forkedReposCount: repos.length - originalRepos.length,
      accountAgeYears,
    },
    recommendations,
  };
}
