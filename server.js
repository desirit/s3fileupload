// server.js - Express server to generate presigned URLs
require('dotenv').config();

const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors');
const path = require('path');
const { ListBucketsCommand } = require('@aws-sdk/client-s3');

// Import configuration from config.js
const config = require('./config');

console.log('AWS Region:', config.aws.region);
console.log('S3 Bucket Name:', config.aws.bucketName);


const BUCKET_NAME = config.aws.bucketName;
if (!BUCKET_NAME) {
  console.error('ERROR: S3 bucket name is not defined! Check your .env file and config.js');
  process.exit(1); // Exit the application if bucket name is missing
}


// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure AWS S3 client
// When running on EC2 with an instance profile, we only need to specify the region
const s3Client = new S3Client({
  region: config.aws.region || 'us-east-1'
  // No need to specify credentials - they'll be automatically retrieved from the instance profile
});

// Constants
const S3_BUCKET_NAME = config.aws.bucketName;
const URL_EXPIRATION = 3600; // URL expiration in seconds (1 hour)

// Add detailed error logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Endpoint to generate presigned URLs
app.post('/generate-upload-url', async (req, res) => {
  try {
    const { password, fileName, contentType } = req.body;

    // Validate password
    if (!password || password !== config.upload.password) {
      console.log('Invalid password attempt');
      return res.status(401).json({ error: 'Invalid password' });
    }

    if (!fileName) {
      return res.status(400).json({ error: 'File name is required' });
    }

    // Create a unique key for the file
    const key = `uploads/${Date.now()}-${fileName}`;

    // Create the command
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: contentType || 'application/octet-stream',
    });

    // Generate the presigned URL
    const uploadURL = await getSignedUrl(s3Client, command, {
      expiresIn: URL_EXPIRATION
    });

    // Return the URL and the key to the client
    res.json({
      uploadURL,
      key
    });
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    res.status(500).json({ error: 'Failed to generate upload URL' });
  }
});

// Endpoint to generate multiple presigned URLs for bulk uploads
app.post('/generate-bulk-upload-urls', async (req, res) => {
  console.log('Request received for bulk upload URLs');
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }

  console.log('Received request for bulk upload URLs');
  console.log('Request method:', req.method);
  console.log('Request headers:', req.headers);

  try {
    // Validate password
    const { password, files } = req.body;

    if (!password || password !== config.upload.password) {
      console.log('Invalid password attempt');
      return res.status(401).json({ error: 'Invalid password' });
    }

    console.log('Password validated, processing files');
    console.log('Request body (files):', JSON.stringify({ files }, null, 2));

    if (!files || !Array.isArray(files) || files.length === 0) {
      console.log('Invalid files array:', files);
      return res.status(400).json({ error: 'Files array is required' });
    }

    console.log('Files array valid, processing', files.length, 'files');
    console.log('Using bucket:', BUCKET_NAME);

    // Generate presigned URLs
    try {
      console.log('Generating presigned URLs...');

      const presignedUrls = await Promise.all(
        files.map(async (file) => {
          console.log('Processing file:', file.fileName);
          const key = `uploads/${Date.now()}-${file.fileName}`;

          try {
            const command = new PutObjectCommand({
              Bucket: BUCKET_NAME,
              Key: key,
              ContentType: file.contentType || 'application/octet-stream',
            });

            console.log('Creating command for', key);
            const uploadURL = await getSignedUrl(s3Client, command, {
              expiresIn: URL_EXPIRATION
            });

            console.log('Generated URL for', key);
            return {
              fileName: file.fileName,
              uploadURL,
              key
            };
          } catch (err) {
            console.error('Error generating URL for file:', file.fileName, err);
            throw err;
          }
        })
      );

      console.log('Successfully generated', presignedUrls.length, 'URLs');
      res.json({ presignedUrls });

    } catch (awsError) {
      console.error('AWS Error:', awsError);
      return res.status(500).json({ error: 'AWS configuration error: ' + awsError.message });
    }

  } catch (error) {
    console.error('General error in generate-bulk-upload-urls:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Start the server
const PORT = config.server.port || 3100;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
