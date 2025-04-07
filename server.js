// server.js - Express server to generate presigned URLs
const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const cors = require('cors');
const dotenv = require('dotenv');
const { ListBucketsCommand } = require('@aws-sdk/client-s3');

dotenv.config();



// Initialize Express app
const app = express();
app.use(express.json());
app.use(cors());

// Configure AWS S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  }
});

// Constants
const BUCKET_NAME = process.env.S3_BUCKET_NAME;
const URL_EXPIRATION = 3600; // URL expiration in seconds (1 hour)

// Add detailed error logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Endpoint to generate presigned URLs
app.post('/generate-upload-url', async (req, res) => {
  try {
    const { fileName, contentType } = req.body;

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
    console.log('Request body:', JSON.stringify(req.body, null, 2));

    const { files } = req.body;

    if (!files || !Array.isArray(files) || files.length === 0) {
      console.log('Invalid files array:', files);
      return res.status(400).json({ error: 'Files array is required' });
    }

    console.log('Files array valid, processing', files.length, 'files');
    console.log('Using bucket:', BUCKET_NAME);

    // Generate presigned URLs without testing credentials first
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
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
