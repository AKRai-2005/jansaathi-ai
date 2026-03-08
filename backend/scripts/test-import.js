console.log('Step 1: Starting...');

try {
  console.log('Step 2: Importing dotenv...');
  const dotenv = await import('dotenv');
  dotenv.default.config();
  
  console.log('Step 3: Importing schemeData...');
  const schemeDataModule = await import('../src/utils/schemeData.js');
  const schemes = schemeDataModule.schemes;
  
  console.log('Step 4: Success! Found', schemes.length, 'schemes');
  console.log('First scheme:', schemes[0].name);
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}
