import { config } from 'dotenv';
import { resolve } from 'path';

export default async function globalSetup() {
  console.log('🔧 [Global Setup] Starting...');
  console.log('Current working directory:', process.cwd());
  
  // Load environment variables from .env.test
  const envFile = `.env.${process.env.NODE_ENV}`;
  console.log('Loading environment from:', envFile);
  
  const result = config({ path: resolve('./', envFile) });
  console.log('Dotenv parsed:', result.parsed);
  
  // Verify that the environment variables are now set
  console.log('Process NODE_ENV:', process.env.NODE_ENV);
  console.log('Process DATABASE_URL:', process.env.DATABASE_URL);
  
  console.log('🔧 [Global Setup] Finished');
}