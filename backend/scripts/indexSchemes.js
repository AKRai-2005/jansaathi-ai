/**
 * Script to index all welfare schemes into the vector store
 * Run with: npm run index-schemes
 */

import dotenv from 'dotenv';
dotenv.config();

import indexingService from '../src/services/indexingService.js';

async function main() {
  console.log('🏛️  JanSaathi Scheme Indexing');
  console.log('=============================\n');

  try {
    // Check if OpenSearch is configured
    if (!process.env.OPENSEARCH_ENDPOINT) {
      console.error('❌ OPENSEARCH_ENDPOINT not configured in .env');
      console.log('\nTo enable RAG:');
      console.log('1. Create an OpenSearch Serverless collection with vector search');
      console.log('2. Add OPENSEARCH_ENDPOINT to your .env file');
      console.log('3. Run this script again\n');
      process.exit(1);
    }

    console.log('📝 Starting scheme indexing...\n');
    
    const result = await indexingService.indexAllSchemes();

    console.log('\n📊 Indexing Results:');
    console.log(`   Total schemes: ${result.total}`);
    console.log(`   Successfully indexed: ${result.success}`);
    console.log(`   Failed: ${result.failed}`);
    console.log(`   Time taken: ${result.elapsedTime}ms`);

    if (result.success === result.total) {
      console.log('\n✅ All schemes indexed successfully!');
    } else if (result.success > 0) {
      console.log('\n⚠️  Some schemes failed to index. Check logs above.');
    } else {
      console.log('\n❌ Indexing failed. Check your OpenSearch configuration.');
    }

    // Show stats
    const stats = await indexingService.getStats();
    console.log('\n📈 Index Statistics:');
    console.log(`   Indexed schemes: ${stats.schemeCount}`);
    console.log(`   Index coverage: ${(stats.indexCoverage * 100).toFixed(1)}%`);

    process.exit(result.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Indexing script failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
