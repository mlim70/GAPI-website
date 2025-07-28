# AWS S3 Setup for Profile Pictures

This guide explains how to set up AWS S3 for storing profile pictures in the GAPI website.

## Prerequisites

1. AWS Account
2. Node.js and npm installed
3. Access to AWS IAM (Identity and Access Management)

## Step 1: Create an S3 Bucket

1. Log into the AWS Console
2. Navigate to S3 service
3. Click "Create bucket"
4. Choose a unique bucket name (e.g., `gapi-profile-pictures`)
5. Select your preferred region
6. Configure bucket settings:
   - Block all public access: **Uncheck** (we need public read access for profile pictures)
   - Versioning: Optional
   - Tags: Optional
7. Click "Create bucket"

## Step 2: Configure Bucket Policy

After creating the bucket, you need to configure it for public read access:

1. Go to your bucket → Permissions → Bucket policy
2. Add the following policy (replace `your-bucket-name` with your actual bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        }
    ]
}
```

## Step 3: Create IAM User

1. Go to IAM service in AWS Console
2. Click "Users" → "Create user"
3. Enter a username (e.g., `gapi-s3-user`)
4. Select "Programmatic access"
5. Click "Next: Permissions"
6. Click "Attach existing policies directly"
7. Search for and select "AmazonS3FullAccess" (or create a custom policy with minimal permissions)
8. Complete the user creation
9. **Important**: Save the Access Key ID and Secret Access Key

## Step 4: Install Dependencies

In the backend directory, install the required AWS SDK packages:

```bash
cd backend
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer
```

## Step 5: Configure Environment Variables

Add the following variables to your `.env` file in the backend directory:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-bucket-name
```

## Step 6: Test the Setup

1. Start your backend server
2. Try uploading a profile picture during registration
3. Check your S3 bucket to see if the file was uploaded successfully

## Security Considerations

1. **IAM Permissions**: Consider creating a custom IAM policy with minimal permissions instead of using `AmazonS3FullAccess`
2. **Bucket Policy**: The bucket policy allows public read access. Consider using CloudFront for better security and performance
3. **File Validation**: The application validates file types and sizes on both frontend and backend
4. **Environment Variables**: Never commit your AWS credentials to version control

## Custom IAM Policy (Recommended)

Instead of using `AmazonS3FullAccess`, create a custom policy with minimal permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:DeleteObject",
                "s3:GetObject"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::your-bucket-name"
        }
    ]
}
```

## Troubleshooting

### Common Issues:

1. **Access Denied**: Check your IAM user permissions and bucket policy
2. **Invalid credentials**: Verify your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY
3. **Bucket not found**: Ensure AWS_S3_BUCKET_NAME matches your actual bucket name
4. **Region mismatch**: Make sure AWS_REGION matches your bucket's region

### Testing Upload:

You can test the S3 upload functionality by:
1. Starting the backend server
2. Going to the registration page
3. Uploading a profile picture
4. Checking your S3 bucket for the uploaded file

## File Structure in S3

Profile pictures will be stored in the following structure:
```
your-bucket-name/
├── avatars/
│   ├── 1234567890-profile1.jpg
│   ├── 1234567891-profile2.png
│   └── ...
```

The files are named with timestamps to ensure uniqueness and avoid conflicts. 