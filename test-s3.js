const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const dotenv = require('dotenv');

dotenv.config();

async function testS3Connection() {
  console.log('Starting S3 connection test...');
  
  // Print environment variables (with secrets masked)
  console.log('AWS_REGION:', process.env.AWS_REGION);
  console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID ? '****' + process.env.AWS_ACCESS_KEY_ID.substr(-4) : 'NOT SET');
  console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY ? '****' + process.env.AWS_SECRET_ACCESS_KEY.substr(-4) : 'NOT SET');
  console.log('S3_BUCKET_NAME:', process.env.S3_BUCKET_NAME);
  
  // Configure AWS S3 client
  const s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    }
  });
  
  try {
    // Try to generate a presigned URL
    const key = `test-file-${Date.now()}.txt`;
    
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      ContentType: 'text/plain',
    });
    
    console.log('Attempting to generate presigned URL...');
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    
    console.log('Success! Generated presigned URL:', url);
    return true;
  } catch (error) {
    console.error('Error during S3 test:', error);
    return false;
  }
}

// Run the test
testS3Connection()
  .then(success => {
    if (success) {
      console.log('S3 connection test passed!');
    } else {
      console.log('S3 connection test failed!');
    }
  })
  .catch(err => {
    console.error('Unhandled error in test:', err);
  });
