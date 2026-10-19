import { describe, it, expect } from 'vitest';
import {
  tokenizeText,
  extractNgrams,
  extractAllNgrams,
  matchTaxonomySkills,
  calculateKeywordDensity,
  matchJobAndResumeDeterministic,
} from '../keywordMatcher';

describe('Deterministic Keyword & Skill Matcher (TS)', () => {
  it('tokenizes text preserving symbols like c++, c#, .net, node.js, ci/cd', () => {
    const text = 'Senior C++ and C# developer with .NET, Node.js, and CI/CD experience.';
    const tokens = tokenizeText(text);
    expect(tokens).toContain('c++');
    expect(tokens).toContain('c#');
    expect(tokens).toContain('.net');
    expect(tokens).toContain('node.js');
    expect(tokens).toContain('ci/cd');
  });

  it('extracts n-grams and filters pure stopwords', () => {
    const tokens = ['looking', 'for', 'a', 'senior', 'react', 'developer'];
    const ngrams = extractAllNgrams(tokens, 3, true);
    expect(ngrams[2]).toContain('react developer');
    expect(ngrams[2]).not.toContain('for a');
  });

  it('matches tech skills against taxonomy accurately', () => {
    const text = 'Backend role using Python, FastAPI, Docker, PostgreSQL, AWS, and Redis.';
    const found = matchTaxonomySkills(text);
    expect(found.python).toBeDefined();
    expect(found.python.category).toBe('languages');
    expect(found.fastapi).toBeDefined();
    expect(found.docker).toBeDefined();
    expect(found.postgresql).toBeDefined();
    expect(found.aws).toBeDefined();
    expect(found.redis).toBeDefined();
  });

  it('computes exact match scores and identifies missing critical keywords', () => {
    const job = 'Required: Python, FastAPI, Docker, Kubernetes, AWS, PostgreSQL, Redis.';
    const resume = 'Experienced Python Developer with FastAPI, Docker, PostgreSQL, and AWS.';

    const report = matchJobAndResumeDeterministic(job, resume);

    expect(report.matchedSkills).toEqual(expect.arrayContaining(['python', 'fastapi', 'docker', 'postgresql', 'aws']));
    expect(report.missingSkills).toEqual(expect.arrayContaining(['kubernetes', 'redis']));
    expect(report.exactMatchScore).toBeGreaterThan(0);
    expect(report.exactMatchScore).toBeLessThan(100);
    expect(report.matchedSkillsCount).toBe(5);
    expect(report.totalJobSkillsCount).toBe(7);
  });

  it('calculates keyword density accurately', () => {
    const tokens = ['python', 'engineer', 'python', 'aws', 'docker', 'python'];
    const density = calculateKeywordDensity(tokens, new Set(['python', 'aws']));
    expect(density.python).toBeGreaterThan(0);
    expect(density.aws).toBeGreaterThan(0);
  });
});
