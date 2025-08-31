# Data Directory - Metadata Management Guide

This directory contains all the metadata files that populate the GAPI website's live contents. Each file serves a specific purpose and follows consistent patterns for easy maintenance.

## 📁 File Overview

### Core Content Files
- **`events.json`** - Event listings and details
- **`news.json`** - News articles and announcements  
- **`homeHero.json`** - Hero carousel content for homepage

### Configuration Files
- **`s3Buckets.json`** - S3 bucket configuration for images
- **`s3Folders.json`** - S3 folder structure for organizing images

---

## Events Management (`events.json`)

### Purpose
Central repository for all GAPI events, both upcoming and past. Used by Events page, Home page, and hero carousel.

### Structure
```json
{
  "events": [
    {
      "id": "unique-string",
      "title": "Event Title",
      "date": "Month Day, Year",
      "location": "Event Location",
      "description": "Brief event description",
      "detailsLink": "/events",
      "imageKey": "events-X"
    }
  ]
}
```

### Field Descriptions
- **`id`**: Unique identifier (used for React keys, not routing)
- **`title`**: Event name (displayed prominently)
- **`date`**: Event date in "Month Day, Year" format (e.g., "July 18-19, 2025")
- **`location`**: Where the event takes place
- **`description`**: Brief overview of the event
- **`detailsLink`**: Always "/events" (routes to main events page)
- **`imageKey`**: S3 object name for event image (e.g., "events-1", "events-2")

### Maintenance Guidelines
1. **Add new events** at the top of the array
2. **Update dates** when events are rescheduled
3. **Keep `detailsLink`** as "/events" (no individual event pages)
4. **Use consistent `imageKey`** naming: "events-1", "events-2", etc.
5. **Date format** must be "Month Day, Year" for automatic parsing

### Automatic Features
- Events are automatically categorized as "upcoming" or "past" based on current date
- Upcoming events appear first on Events page
- Past events are sorted by most recent first
- Home page shows top 3 upcoming and 3 past events

---

## News Management (`news.json`)

### Purpose
Stores all news articles, announcements, and member updates. Powers News page and home page latest news section.

### Structure
```json
{
  "news": [
    {
      "id": "unique-string",
      "title": "News Title",
      "date": "YYYY-MM-DD",
      "excerpt": "Brief summary",
      "content": "Full article content",
      "category": "news|announcement|member-news",
      "author": "Author Name",
      "imageKey": "news-X"
    }
  ],
  "categories": [
    {
      "id": "category-id",
      "name": "Category Name",
      "description": "Category description"
    }
  ]
}
```

### Field Descriptions
- **`id`**: Unique identifier (used for React keys)
- **`title`**: News headline
- **`date`**: Publication date in ISO format (YYYY-MM-DD)
- **`excerpt`**: Short summary for previews
- **`content`**: Full article text
- **`category`**: One of: "news", "announcement", "member-news"
- **`author`**: Who wrote the article
- **`imageKey`**: S3 object name for news image (e.g., "news-1", "news-2")
- **`featured`**: Boolean flag (currently unused, reserved for future features)

### Maintenance Guidelines
1. **Use ISO date format** (YYYY-MM-DD) for consistent sorting
2. **Categorize appropriately** for proper filtering

### Automatic Features
- News is automatically sorted by date (newest first)
- Home page displays 3 most recent news items
- Category filtering on News page
- Featured field available for future enhancements

---

## Home Hero Management (`homeHero.json`)

### Purpose
Controls the hero carousel on the homepage. Displays featured events with dynamic status and routing.

### Structure
```json
{
  "events": [
    {
      "id": "unique-string",
      "title": "Event Title",
      "description": "Event description",
      "date": "Month Day, Year",
      "location": "Event Location",
      "imageKey": "hero/image-name.jpg",
      "detailsLink": "/events"
    }
  ]
}
```

### Field Descriptions
- **`id`**: Unique identifier (used for React keys)
- **`title`**: Event name displayed in carousel
- **`description`**: Brief event overview
- **`date`**: Event date in "Month Day, Year" format
- **`location`**: Where the event takes place
- **`imageKey`**: S3 object route for hero image (typically "hero/filename.jpg")
- **`detailsLink`**: Always "/events" (routes to main events page)

### Maintenance Guidelines
1. **Upload images to "gapi-home" bucket, "hero" folder**

### Automatic Features
- `isUpcoming` status is computed dynamically from date
- Events show "(Upcoming)" label when appropriate
- Buttons automatically route to events page
- Carousel auto-plays with manual navigation controls

---

## S3 Image Management

### Bucket Configuration (`s3Buckets.json`)
Defines S3 bucket names for different content types:
- **`gapi-events`**: Event images
- **`gapi-news`**: News article images  
- **`gapi-home`**: Homepage images (hero, gallery)

### Folder Structure (`s3Folders.json`)
Organizes images within buckets:
- **`hero/ folder`**: Hero carousel images
- **`gallery/ folder`**: Homepage gallery images
- **`events`**: Event-specific images
- **`news`**: News-specific images

---

## Update Workflow

### Adding New Content
1. **Create/update** the appropriate JSON file
2. **Upload images** to corresponding S3 bucket/folder
3. **Update `imageKey`** fields to match S3 object names