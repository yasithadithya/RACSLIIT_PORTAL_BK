const REQUIRED_ENV_VARS = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'MONGODB_URI'];

export const validateEnv = (): void => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(`\n❌ Missing required environment variable(s): ${missing.join(', ')}`);
    console.error('   Set these in backend/.env before starting the server.\n');
    process.exit(1);
  }
};
