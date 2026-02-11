
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
    origin: '*', // Production дээр үүнийг өөрийн домэйн болгож солиорой (жишээ нь: https://cjtravel.pages.dev)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// 2. Database Connection (PostgreSQL)
// DigitalOcean App Platform автоматаар DATABASE_URL хувьсагчийг өгдөг.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 3. Cloudflare R2 Connection
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// --- ROUTES ---

// Health Check (DigitalOcean үүнийг шалгаж сервер ажиллаж байгаа эсэхийг мэднэ)
app.get('/', (req, res) => {
  res.send('CJ Travel Backend is running!');
});

// API: Get Presigned URL for Uploading Images to R2
app.post('/api/upload-url', async (req, res) => {
  try {
    const { fileName, fileType } = req.body;
    
    // Өвөрмөц нэр үүсгэх (давхцахаас сэргийлнэ)
    const uniqueFileName = `uploads/${Date.now()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: uniqueFileName,
      ContentType: fileType,
      // ACL: 'public-read' // R2 дээр тохиргооноос хамаарна
    });

    // 1 цагийн хугацаатай түр линк үүсгэх
    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    res.json({ 
      uploadUrl: url, 
      fileUrl: `${process.env.R2_PUBLIC_URL}/${uniqueFileName}` 
    });
  } catch (error) {
    console.error('R2 Error:', error);
    res.status(500).json({ error: 'Failed to create upload URL' });
  }
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
