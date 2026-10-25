import {
  assertProductionEnv,
  productionEnvProblems,
  resolveWebOrigin,
} from './app.config.js';
import { validateEnv } from './queue.config.js';

const productionEnv = {
  NODE_ENV: 'production',
  WEB_ORIGIN: 'https://coder.example.com',
  JWT_SECRET: 'a-long-random-production-secret',
  DATABASE_URL: 'postgres://db.internal/coder',
  REDIS_HOST: 'redis.internal',
  AI_DEFAULT_PROVIDER: 'anthropic',
  ANTHROPIC_API_KEY: 'set',
};

describe('production boot guard', () => {
  it('passes a complete production environment', () => {
    expect(productionEnvProblems(productionEnv)).toEqual([]);
    expect(() => validateEnv({ ...productionEnv })).not.toThrow();
  });

  it('refuses the default JWT secret', () => {
    expect(() =>
      assertProductionEnv({ ...productionEnv, JWT_SECRET: 'dev-jwt-secret' }),
    ).toThrow('JWT_SECRET must be set to a non-default value');
    expect(() =>
      validateEnv({ ...productionEnv, JWT_SECRET: 'dev-jwt-secret' }),
    ).toThrow('Refusing to start in production');
  });

  it('lists every missing variable', () => {
    expect(
      productionEnvProblems({ NODE_ENV: 'production', AI_DEFAULT_PROVIDER: 'openai' }),
    ).toEqual([
      'WEB_ORIGIN is required',
      'JWT_SECRET must be set to a non-default value',
      'DATABASE_URL is required',
      'REDIS_HOST is required',
      'OPENAI_API_KEY is required for AI_DEFAULT_PROVIDER=openai',
    ]);
  });

  it('requires the key for the connected provider only', () => {
    expect(
      productionEnvProblems({
        ...productionEnv,
        ANTHROPIC_API_KEY: '',
        OPENAI_API_KEY: 'set',
      }),
    ).toEqual(['ANTHROPIC_API_KEY is required for AI_DEFAULT_PROVIDER=anthropic']);
  });

  it('keeps development defaults outside production', () => {
    expect(productionEnvProblems({ JWT_SECRET: 'dev-jwt-secret' })).toEqual([]);
    expect(resolveWebOrigin({})).toBe('http://localhost:5173');
    expect(resolveWebOrigin({ WEB_ORIGIN: 'https://coder.example.com/' })).toBe(
      'https://coder.example.com',
    );
  });
});
