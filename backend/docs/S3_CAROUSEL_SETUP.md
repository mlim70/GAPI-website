# S3 Carousel Setup Guide

This guide explains how to set up different S3 buckets for your carousels.

## Environment Variables

Add these environment variables to your `.env` file:

```env
# Base S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key

# Default bucket (fallback)
AWS_S3_BUCKET_NAME=your-default-bucket

# Optional: Separate buckets for different carousel types
AWS_S3_HERO_BUCKET=your-hero-carousel-bucket
AWS_S3_EVENTS_BUCKET=your-events-bucket
AWS_S3_CLINIC_BUCKET=your-clinic-bucket
AWS_S3_GALLERY_BUCKET=your-gallery-bucket
```

## Bucket Structure

### Option 1: Single Bucket with Folders
If you use a single bucket, organize your images in folders:

```
your-default-bucket/
├── hero-carousel/
│   ├── hero1.jpg
│   ├── hero2.jpg
│   └── hero3.jpg
├── events/
│   ├── event1.jpg
│   ├── event2.jpg
│   └── event3.jpg
└── gallery/
    ├── gallery1.jpg
    ├── gallery2.jpg
    └── gallery3.jpg
```

### Option 2: Separate Buckets
If you use separate buckets, each bucket can have its own structure:

```
hero-carousel-bucket/
├── hero1.jpg
├── hero2.jpg
└── hero3.jpg

events-bucket/
├── event1.jpg
├── event2.jpg
└── event3.jpg

gallery-bucket/
├── gallery1.jpg
├── gallery2.jpg
└── gallery3.jpg
```

## API Endpoints

Once configured, you can access your carousel images via these endpoints:

- `GET /api/carousels/heroCarousel` - Get hero carousel images
- `GET /api/carousels/eventCarousel` - Get event carousel images  
- `GET /api/carousels/clinicCarousel` - Get clinic carousel images
- `GET /api/carousels/galleryCarousel` - Get gallery carousel images
- `GET /api/carousels` - Get summary of all carousels

## Supported Image Formats

The system supports these image formats:
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)

## Security Considerations

1. **Bucket Permissions**: Ensure your S3 buckets have appropriate read permissions
2. **CORS Configuration**: Configure CORS on your S3 buckets to allow access from your frontend domain
3. **Rate Limiting**: The API includes rate limiting (100 requests per minute per IP)

## CORS Configuration Example

Add this CORS configuration to your S3 buckets:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET"],
        "AllowedOrigins": ["http://localhost:5173", "https://yourdomain.com"],
        "ExposeHeaders": []
    }
]
```

## Testing

You can test the setup by:

1. Upload some images to your S3 buckets
2. Start your backend server
3. Visit `http://localhost:4000/api/carousels` to see the summary
4. Check individual carousels: `http://localhost:4000/api/carousels/heroCarousel`
5. Check clinic carousel: `http://localhost:4000/api/carousels/clinicCarousel`

## Troubleshooting

- **No images showing**: Check bucket permissions and folder structure
- **CORS errors**: Verify CORS configuration on your S3 buckets
- **Rate limiting**: Check if you're hitting the rate limit (100 requests/minute)
- **Environment variables**: Ensure all required environment variables are set 