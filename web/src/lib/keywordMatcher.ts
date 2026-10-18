/**
 * Deterministic Technical Skill & Keyword Matcher (Client-side TypeScript Helper)
 * 100% deterministic (no AI/LLM tokens), runs fully in-browser or edge runtime.
 * Provides tokenization, stopword filtering, n-gram extraction, tech taxonomy matching,
 * exact match scoring, missing critical keyword identification, and keyword density.
 */

export interface TaxonomyEntry {
  category: 'languages' | 'frameworks' | 'cloud' | 'databases' | 'tools' | 'developer practices' | 'other';
  aliases: string[];
}

export const TECH_TAXONOMY: Record<string, TaxonomyEntry> = {
  // Programming Languages
  python: { category: 'languages', aliases: ['python', 'py', 'python3', 'python2'] },
  javascript: { category: 'languages', aliases: ['javascript', 'js', 'ecmascript', 'es6', 'es2015', 'es2020'] },
  typescript: { category: 'languages', aliases: ['typescript', 'ts'] },
  java: { category: 'languages', aliases: ['java', 'core java', 'j2ee', 'jee', 'java 8', 'java 11', 'java 17', 'java 21'] },
  golang: { category: 'languages', aliases: ['golang', 'go', 'go language'] },
  'c++': { category: 'languages', aliases: ['c++', 'cpp'] },
  'c#': { category: 'languages', aliases: ['c#', 'csharp', 'c sharp', '.net', 'dotnet'] },
  c: { category: 'languages', aliases: ['c language'] },
  rust: { category: 'languages', aliases: ['rust', 'rustlang'] },
  scala: { category: 'languages', aliases: ['scala'] },
  kotlin: { category: 'languages', aliases: ['kotlin'] },
  swift: { category: 'languages', aliases: ['swift'] },
  ruby: { category: 'languages', aliases: ['ruby', 'ruby on rails', 'rails'] },
  php: { category: 'languages', aliases: ['php', 'laravel', 'symfony'] },
  sql: { category: 'languages', aliases: ['sql', 'advanced sql', 'pl/sql', 'plsql', 't-sql', 'tsql'] },
  bash: { category: 'languages', aliases: ['bash', 'shell scripting', 'shell script', 'shell', 'sh', 'zsh'] },
  r: { category: 'languages', aliases: ['r language', 'r programming'] },

  // Frontend Frameworks & Web
  react: { category: 'frameworks', aliases: ['react', 'react.js', 'reactjs'] },
  'react native': { category: 'frameworks', aliases: ['react native', 'react-native'] },
  'next.js': { category: 'frameworks', aliases: ['next.js', 'nextjs', 'next js'] },
  angular: { category: 'frameworks', aliases: ['angular', 'angularjs', 'angular 2+'] },
  vue: { category: 'frameworks', aliases: ['vue', 'vue.js', 'vuejs'] },
  svelte: { category: 'frameworks', aliases: ['svelte', 'sveltekit'] },
  html: { category: 'frameworks', aliases: ['html', 'html5'] },
  css: { category: 'frameworks', aliases: ['css', 'css3', 'sass', 'scss', 'less'] },
  tailwind: { category: 'frameworks', aliases: ['tailwind', 'tailwind css', 'tailwindcss'] },
  redux: { category: 'frameworks', aliases: ['redux', 'redux toolkit', 'rtk', 'zustand', 'mobx'] },

  // Backend Frameworks & Architecture
  'node.js': { category: 'frameworks', aliases: ['node.js', 'nodejs', 'node js', 'node'] },
  express: { category: 'frameworks', aliases: ['express', 'express.js', 'expressjs'] },
  nestjs: { category: 'frameworks', aliases: ['nestjs', 'nest.js'] },
  'spring boot': { category: 'frameworks', aliases: ['spring boot', 'springboot', 'spring framework', 'spring'] },
  django: { category: 'frameworks', aliases: ['django', 'django rest framework', 'drf'] },
  flask: { category: 'frameworks', aliases: ['flask'] },
  fastapi: { category: 'frameworks', aliases: ['fastapi', 'fast api'] },
  microservices: { category: 'developer practices', aliases: ['microservices', 'microservice', 'distributed systems', 'service-oriented'] },
  restful: { category: 'developer practices', aliases: ['restful', 'rest api', 'rest apis', 'restful api', 'restful apis', 'rest'] },
  graphql: { category: 'frameworks', aliases: ['graphql'] },
  grpc: { category: 'frameworks', aliases: ['grpc'] },
  kafka: { category: 'databases', aliases: ['kafka', 'apache kafka'] },
  rabbitmq: { category: 'tools', aliases: ['rabbitmq', 'rabbit mq', 'activemq'] },
  redis: { category: 'databases', aliases: ['redis', 'caching', 'memcached'] },

  // Cloud & DevOps
  aws: { category: 'cloud', aliases: ['aws', 'amazon web services', 'ec2', 's3', 'lambda', 'ecs', 'eks', 'rds', 'sqs', 'sns', 'cloudformation', 'iam'] },
  azure: { category: 'cloud', aliases: ['azure', 'microsoft azure', 'azure devops', 'blob storage', 'aks'] },
  gcp: { category: 'cloud', aliases: ['gcp', 'google cloud', 'google cloud platform', 'bigquery', 'gke'] },
  docker: { category: 'tools', aliases: ['docker', 'containerization', 'containers', 'dockerfile', 'docker compose'] },
  kubernetes: { category: 'tools', aliases: ['kubernetes', 'k8s', 'helm'] },
  terraform: { category: 'tools', aliases: ['terraform', 'iac', 'infrastructure as code'] },
  'ci/cd': { category: 'developer practices', aliases: ['ci/cd', 'ci-cd', 'cicd', 'continuous integration', 'continuous deployment', 'continuous delivery'] },
  jenkins: { category: 'tools', aliases: ['jenkins'] },
  github: { category: 'tools', aliases: ['github', 'git', 'gitlab', 'bitbucket', 'version control'] },
  ansible: { category: 'tools', aliases: ['ansible'] },
  linux: { category: 'tools', aliases: ['linux', 'unix', 'ubuntu', 'debian', 'centos', 'redhat'] },

  // Databases & Big Data
  postgresql: { category: 'databases', aliases: ['postgresql', 'postgres', 'psql'] },
  mysql: { category: 'databases', aliases: ['mysql', 'mariadb'] },
  mongodb: { category: 'databases', aliases: ['mongodb', 'mongo'] },
  dynamodb: { category: 'databases', aliases: ['dynamodb'] },
  elasticsearch: { category: 'databases', aliases: ['elasticsearch', 'elastic search', 'opensearch', 'elk', 'elk stack'] },
  snowflake: { category: 'databases', aliases: ['snowflake'] },
  databricks: { category: 'databases', aliases: ['databricks'] },
  spark: { category: 'databases', aliases: ['spark', 'apache spark', 'pyspark'] },
  hadoop: { category: 'databases', aliases: ['hadoop', 'hdfs', 'mapreduce'] },
  cassandra: { category: 'databases', aliases: ['cassandra', 'apache cassandra'] },
  oracle: { category: 'databases', aliases: ['oracle', 'oracle db'] },

  // QA, SDET & Testing
  selenium: { category: 'tools', aliases: ['selenium', 'selenium webdriver'] },
  playwright: { category: 'tools', aliases: ['playwright'] },
  cypress: { category: 'tools', aliases: ['cypress'] },
  sdet: { category: 'developer practices', aliases: ['sdet', 'software development engineer in test'] },
  'test automation': { category: 'developer practices', aliases: ['test automation', 'automated testing', 'automation testing', 'test suites'] },
  qa: { category: 'developer practices', aliases: ['qa', 'quality assurance', 'software quality', 'testing'] },
  testng: { category: 'tools', aliases: ['testng'] },
  junit: { category: 'tools', aliases: ['junit'] },
  pytest: { category: 'tools', aliases: ['pytest'] },
  postman: { category: 'tools', aliases: ['postman', 'api testing'] },
  jmeter: { category: 'tools', aliases: ['jmeter', 'performance testing', 'load testing'] },
  appium: { category: 'tools', aliases: ['appium', 'mobile testing'] },
  cucumber: { category: 'tools', aliases: ['cucumber', 'bdd', 'behavior driven development'] },

  // AI & Data Science
  'machine learning': { category: 'developer practices', aliases: ['machine learning', 'ml'] },
  'deep learning': { category: 'developer practices', aliases: ['deep learning', 'neural networks', 'ann', 'cnn', 'rnn'] },
  ai: { category: 'developer practices', aliases: ['ai', 'artificial intelligence', 'genai', 'generative ai', 'llm', 'llms', 'large language models'] },
  pytorch: { category: 'frameworks', aliases: ['pytorch', 'torch'] },
  tensorflow: { category: 'frameworks', aliases: ['tensorflow', 'tf', 'keras'] },
  pandas: { category: 'tools', aliases: ['pandas'] },
  numpy: { category: 'tools', aliases: ['numpy'] },
  'scikit-learn': { category: 'tools', aliases: ['scikit-learn', 'sklearn'] },
  'power bi': { category: 'tools', aliases: ['power bi', 'powerbi'] },
  tableau: { category: 'tools', aliases: ['tableau'] },

  // Methodologies & Principles
  agile: { category: 'developer practices', aliases: ['agile', 'scrum', 'kanban', 'sprints'] },
  'system design': { category: 'developer practices', aliases: ['system design', 'solution architecture', 'software architecture', 'hld', 'lld'] },
  oop: { category: 'developer practices', aliases: ['oop', 'object-oriented', 'object oriented', 'solid principles', 'design patterns'] },
  tdd: { category: 'developer practices', aliases: ['tdd', 'test driven development'] },
};

export const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but',
  'by', 'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for',
  'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'him',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more',
  'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other',
  'our', 'ours', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were',
  'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'you', 'your', 'yours',
  'role', 'roles', 'candidate', 'responsibilities', 'requirements', 'experience', 'years', 'looking'
]);

export interface KeywordMatchReport {
  exactMatchScore: number;
  matchedSkillsCount: number;
  totalJobSkillsCount: number;
  matchedSkills: string[];
  matchedByCategory: Record<string, string[]>;
  missingSkills: string[];
  missingCriticalKeywords: string[];
  keywordDensity: Record<string, number>;
  stats: {
    jobWordCount: number;
    jobUniqueTerms: number;
    resumeWordCount: number;
    resumeUniqueTerms: number;
    jobTechSkillsCount: number;
    resumeTechSkillsCount: number;
  };
  jobNgramsSample: {
    unigramsCount: number;
    bigramsCount: number;
    trigramsCount: number;
  };
}

/**
 * Tokenize string while preserving symbols like c++, c#, .net, node.js, ci/cd
 */
export function tokenizeText(text: string): string[] {
  if (!text) return [];
  const clean = text.toLowerCase().replace(/[\r\n\t]/g, ' ');
  const rawTokens = clean.match(/[\w\.\+\#\/\-]+/g) || [];
  const tokens: string[] = [];

  for (let t of rawTokens) {
    t = t.replace(/[,;:]+$/g, '');
    if (t.endsWith('.') && !t.startsWith('.')) {
      t = t.replace(/\.+$/g, '');
    }
    if (t) {
      tokens.push(t);
    }
  }
  return tokens;
}

/**
 * Extract n-grams from a token sequence
 */
export function extractNgrams(tokens: string[], n: number): string[] {
  if (n < 1 || tokens.length < n) return [];
  const ngrams: string[] = [];
  for (let i = 0; i <= tokens.length - n; i++) {
    ngrams.push(tokens.slice(i, i + n).join(' '));
  }
  return ngrams;
}

/**
 * Extract 1-gram, 2-gram, 3-grams
 */
export function extractAllNgrams(
  tokens: string[],
  maxN: number = 3,
  filterStopwords: boolean = false
): Record<number, string[]> {
  const result: Record<number, string[]> = {};
  for (let n = 1; n <= maxN; n++) {
    const list = extractNgrams(tokens, n);
    if (filterStopwords) {
      result[n] = list.filter((ng) => {
        const words = ng.split(' ');
        if (words.every((w) => STOPWORDS.has(w))) return false;
        if (STOPWORDS.has(words[0]) && STOPWORDS.has(words[words.length - 1])) return false;
        return true;
      });
    } else {
      result[n] = list;
    }
  }
  return result;
}

/**
 * Scan text against TECH_TAXONOMY
 */
export function matchTaxonomySkills(text: string): Record<string, { category: string; matchedAlias: string; count: number }> {
  const rawLower = ` ${text.toLowerCase()} `;
  // Replace punctuation but preserve dots in .net and node.js
  const cleanedPunct = rawLower
    .replace(/[\,\;\:\!\?\(\)\[\]\{\}\"\'\|\*\`\~]/g, ' ')
    .replace(/(?<=\w)\.(?=\s|$)/g, ' ');
  const normalizedSpaced = ` ${cleanedPunct.replace(/\s+/g, ' ')} `;

  const found: Record<string, { category: string; matchedAlias: string; count: number }> = {};

  for (const [canonical, entry] of Object.entries(TECH_TAXONOMY)) {
    let totalCount = 0;
    let bestAlias = canonical;

    for (const alias of entry.aliases) {
      const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(?<![a-zA-Z0-9\\+\\#\\.\\/])${escaped}(?![a-zA-Z0-9\\+\\#\\.\\/])`, 'g');
      const matches = normalizedSpaced.match(regex);
      if (matches) {
        totalCount += matches.length;
        bestAlias = alias;
      }
    }

    if (totalCount > 0) {
      found[canonical] = {
        category: entry.category,
        matchedAlias: bestAlias,
        count: totalCount,
      };
    }
  }

  return found;
}

/**
 * Compute keyword density for target set
 */
export function calculateKeywordDensity(tokens: string[], targetKeywords: Set<string>): Record<string, number> {
  const filtered = tokens.filter((t) => !STOPWORDS.has(t) && t.length > 1);
  const total = filtered.length;
  if (total === 0) return {};

  const counts: Record<string, number> = {};
  for (const t of filtered) {
    counts[t] = (counts[t] || 0) + 1;
  }

  const density: Record<string, number> = {};
  for (const kw of targetKeywords) {
    const parts = kw.split(' ');
    let cnt = 0;
    if (parts.length === 1) {
      cnt = counts[kw] || 0;
    } else {
      for (let i = 0; i <= filtered.length - parts.length; i++) {
        if (parts.every((p, idx) => filtered[i + idx] === p)) {
          cnt++;
        }
      }
    }
    if (cnt > 0) {
      density[kw] = Number(((cnt / total) * 100).toFixed(2));
    }
  }

  return density;
}

/**
 * Main Deterministic Matching Algorithm
 */
export function matchJobAndResumeDeterministic(jobText: string, resumeText: string): KeywordMatchReport {
  const jobTokens = tokenizeText(jobText);
  const resumeTokens = tokenizeText(resumeText);

  const jobFiltered = jobTokens.filter((t) => !STOPWORDS.has(t));
  const resumeFiltered = resumeTokens.filter((t) => !STOPWORDS.has(t));

  const jobNgrams = extractAllNgrams(jobTokens, 3, true);

  const jobSkills = matchTaxonomySkills(jobText);
  const resumeSkills = matchTaxonomySkills(resumeText);

  const jobSkillKeys = Object.keys(jobSkills);
  const resumeSkillKeys = new Set(Object.keys(resumeSkills));

  const matchedSkills = jobSkillKeys.filter((s) => resumeSkillKeys.has(s)).sort();
  const missingSkills = jobSkillKeys.filter((s) => !resumeSkillKeys.has(s)).sort();

  let exactMatchScore = 0;
  if (jobSkillKeys.length > 0) {
    exactMatchScore = Number(((matchedSkills.length / jobSkillKeys.length) * 100).toFixed(2));
  } else {
    const jobWordSet = new Set(jobFiltered);
    const resumeWordSet = new Set(resumeFiltered);
    if (jobWordSet.size > 0) {
      let overlap = 0;
      jobWordSet.forEach((w) => {
        if (resumeWordSet.has(w)) overlap++;
      });
      exactMatchScore = Number(((overlap / jobWordSet.size) * 100).toFixed(2));
    } else {
      exactMatchScore = 100;
    }
  }

  // Critical skills (sorted by frequency in job text)
  const criticalSorted = [...jobSkillKeys].sort((a, b) => (jobSkills[b]?.count || 0) - (jobSkills[a]?.count || 0));
  const missingCriticalKeywords = criticalSorted.filter((s) => !resumeSkillKeys.has(s));

  // Density
  const targetSet = new Set([...jobSkillKeys, ...matchedSkills]);
  const keywordDensity = calculateKeywordDensity(resumeTokens, targetSet);

  // Categorize
  const matchedByCategory: Record<string, string[]> = {};
  for (const s of matchedSkills) {
    const cat = TECH_TAXONOMY[s]?.category || 'other';
    if (!matchedByCategory[cat]) {
      matchedByCategory[cat] = [];
    }
    matchedByCategory[cat].push(s);
  }

  return {
    exactMatchScore,
    matchedSkillsCount: matchedSkills.length,
    totalJobSkillsCount: jobSkillKeys.length,
    matchedSkills,
    matchedByCategory,
    missingSkills,
    missingCriticalKeywords,
    keywordDensity,
    stats: {
      jobWordCount: jobTokens.length,
      jobUniqueTerms: new Set(jobFiltered).size,
      resumeWordCount: resumeTokens.length,
      resumeUniqueTerms: new Set(resumeFiltered).size,
      jobTechSkillsCount: jobSkillKeys.length,
      resumeTechSkillsCount: resumeSkillKeys.size,
    },
    jobNgramsSample: {
      unigramsCount: jobNgrams[1]?.length || 0,
      bigramsCount: jobNgrams[2]?.length || 0,
      trigramsCount: jobNgrams[3]?.length || 0,
    },
  };
}
