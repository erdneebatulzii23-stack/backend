
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const app = express();
const port = process.env.PORT || 8080;

// 1. Middleware
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 2. Database Connection (PostgreSQL)
// Database Ð·Ð°Ð°Ð²Ð°Ð» Ð±Ð°Ð¹Ñ… ÑˆÐ°Ð°Ñ€Ð´Ð»Ð°Ð³Ð°Ñ‚Ð°Ð¹
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 3. Storage Connection (Optional)
// S3_ENDPOINT Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹ Ð±Ð¾Ð» Ð°Ð»Ð´Ð°Ð° Ð·Ð°Ð°Ñ…Ð³Ò¯Ð¹, Ð·Ò¯Ð³ÑÑÑ€ Ð» s3Client Ò¯Ò¯ÑÑÑ…Ð³Ò¯Ð¹.
let s3Client = null;
if (process.env.S3_ENDPOINT && process.env.S3_ACCESS_KEY_ID) {
    s3Client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
} else {
    console.log("Storage config missing. Image upload will be disabled.");
}

// --- ROUTES ---

// Health Check
app.get('/', (req, res) => {
  res.send('CJ Travel Backend is running!');
});

// API: Get Presigned URL for Uploading Images
app.post('/api/upload-url', async (req, res) => {
  // Ð¥ÑÑ€ÑÐ² Storage Ñ‚Ð¾Ñ…Ð¸Ñ€Ð³Ð¾Ð¾ Ð±Ð°Ð¹Ñ…Ð³Ò¯Ð¹ Ð±Ð¾Ð» Ð°Ð»Ð´Ð°Ð° Ð±ÑƒÑ†Ð°Ð°Ð½Ð°
  if (!s3Client) {
      console.error('Storage not configured');
      return res.status(503).json({ error: 'Storage not configured. Cannot upload image.' });
  }

  try {
    const { fileName, fileType } = req.body;
    const uniqueFileName = `uploads/${Date.now()}-${fileName.replace(/\s+/g, '-')}`;

    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
      ACL: 'public-read'
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    const fileUrl = `${process.env.S3_PUBLIC_URL || process.env.S3_ENDPOINT}/${uniqueFileName}`;

    res.json({ uploadUrl: url, fileUrl: fileUrl });
  } catch (error) {
    console.error('Storage Error:', error);
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
