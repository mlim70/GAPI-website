import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import HeroSection from '../components/home/HeroSection.js';
import EventImageCarousel from '../components/home/EventImageCarousel.js';
import HomeNewsSection from '../components/home/HomeNewsSection.js';
import SponsorSection from '../components/home/SponsorSection.js';
import NewsletterSignup from '../components/common/NewsletterSignup.js';
import { fetchS3ImagesFromFolder } from '../api/s3.js';
import { getS3Buckets, getS3Folders } from '../config/s3.js';
import { imageCache } from '../utils/imageCache.js';

export default function Home() {
  const [carouselImages, setCarouselImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(true);

  useEffect(() => {
    async function loadCarouselImages() {
      try {
        setIsImageLoading(true);
        
        // Get fresh S3 configuration
        const s3Buckets = getS3Buckets();
        const s3Folders = getS3Folders();
        
        // Check cache first
        const cachedImages = imageCache.get('gallery-carousel-urls');
        if (cachedImages) {
          setCarouselImages(cachedImages);
          setIsImageLoading(false);
          return;
        }
        
        console.log('🔍 Fetching gallery carousel images from backend...');
        const images = await fetchS3ImagesFromFolder(s3Buckets.website, s3Folders.events);
        console.log('📦 Gallery carousel images result:', images);
        
        // Extract URLs from S3Image objects
        const imageUrls = images.map(img => img.url);
        
        // Cache the URLs
        imageCache.set('gallery-carousel-urls', imageUrls);
        
        setCarouselImages(imageUrls);
      } catch (error) {
        console.error('❌ Error fetching gallery carousel images:', error);
      } finally {
        setLoading(false);
        setIsImageLoading(false);
      }
    }

    loadCarouselImages();
  }, []);

  // Upcoming events data
  const upcomingEvents: any[] = [];

  // Past events data
  const pastEvents = [
    {
      id: '5',
      title: 'GAPI Annual and Scientific Meeting 2025',
      date: 'July 18-19, 2025',
      description: 'Save the date for our premier annual gathering featuring scientific sessions, networking opportunities, and cultural celebrations.',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZXdpZHRoPSIyIiBkPSJNNCAxNmw0LjU4Ni00LjU4NmEyIDIgMCAwIDEgMi44MjggMEwxNiAxNm0tMi0ybDEuNTg2LTEuNTg2YTIgMiAwIDAgMSAyLjgyOCAwTDIwIDE0bS02LTZoLjAxTTYgMjBoMTJhMiAyIDAgMCAwIDItMlY2YTIgMiAwIDAgMC0yLTJINmEyIDIgMCAwIDAtMiAydjEyYTIgMiAwIDAgMCAyIDJ6Ii8+Cjwvc3ZnPgo8L3N2Zz4K',
      detailsLink: '#',
    },
    {
      id: '6',
      title: 'Physician-Themed Indian Fashion Show 2025',
      date: 'July 18, 2025',
      description: 'A Tribute to India\'s Weavers by Georgia\'s Physicians: An elegant celebration of culture, craftsmanship, and community.',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZXdpZHRoPSIyIiBkPSJNNCAxNmw0LjU4Ni00LjU4NmEyIDIgMCAwIDEgMi44MjggMEwxNiAxNm0tMi0ybDEuNTg2LTEuNTg2YTIgMiAwIDAgMSAyLjgyOCAwTDIwIDE0bS02LTZoLjAxTTYgMjBoMTJhMiAyIDAgMCAwIDItMlY2YTIgMiAwIDAgMC0yLTJINmEyIDIgMCAwIDAtMiAydjEyYTIgMiAwIDAgMCAyIDJ6Ii8+Cjwvc3ZnPgo8L3N2Zz4K',
      detailsLink: '#',
    },
    {
      id: '7',
      title: 'Choreographed Performances by Physician Members',
      date: 'July 18, 2025',
      description: 'Experience the artistic talents of our physician members through captivating choreographed performances.',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2UtbGluZXdpZHRoPSIyIiBkPSJNNCAxNmw0LjU4Ni00LjU4NmEyIDIgMCAwIDEgMi44MjggMEwxNiAxNm0tMi0ybDEuNTg2LTEuNTg2YTIgMiAwIDAgMSAyLjgyOCAwTDIwIDE0bS02LTZoLjAxTTYgMjBoMTJhMiAyIDAgMCAwIDItMlY2YTIgMiAwIDAgMC0yLTJINmEyIDIgMCAwIDAtMiAydjEyYTIgMiAwIDAgMCAyIDJ6Ii8+Cjwvc3ZnPgo8L3N2Zz4K',
      detailsLink: '#',
    },
    {
      id: '8',
      title: 'Robotic Surgery System Hands-on Practice',
      date: 'July 19, 2025',
      description: 'Special attraction featuring a very cool Robotic Surgery System for hands-on practice. Open to physicians and non-physicians.',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3RvcC1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIgc3Ryb2tlLXdpZHRoPSIyIiBkPSJNMTcgMjBoNXYtMmEzIDMgMCAwIDAtNS4zNTYtMS44NTdNMTcgMjBIN20xMCAwdi0yYzAtLjY1Ni0uMTI2LTEuMjgzLS4zNTYtMS44NTdtMCAwYTUuMDAyIDUuMDAyIDAgMCAxIDkuMjg4IDBNMTUgN2EzIDMgMCAxMS02IDAgMyAzIDAgMCAxIDYgMHptNiAzYTIgMiAwIDExLTQgMCAyIDIgMCAwMTQgMHpNNyAxMGEyIDIgMCAxMS00IDAgMiAyIDAgMDE0IDB6Ii8+Cjwvc3ZnPgo8L3N2Zz4K',
      detailsLink: '#',
    },
    {
      id: '1',
      title: 'Warner Robins Regional Meeting',
      date: 'March 22, 2025',
      description: 'Successful regional gathering with networking and educational sessions.',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik00IDE2bDQuNTg2LTQuNTg2YTIgMiAwIDAgMSAyLjgyOCAwTDE2IDE2bS0yLTJsMS41ODYtMS41ODZhMiAyIDAgMCAxIDIuODI4IDBMMjAgMTRtLTYtNmguMDFNNiAyMGgxMmEyIDIgMCAwIDAgMi0yVjZhMiAyIDAgMCAwLTItMkg2YTIgMiAwIDAgMC0yIDJ2MTJhMiAyIDAgMCAwIDIgMnoiLz4KPC9zdmc+Cjwvc3ZnPgo=',
      detailsLink: '#',
    },
    {
      id: '2',
      title: 'Columbus Regional Meeting',
      date: 'March 8, 2025',
      description: 'Regional meeting featuring community engagement and professional development.',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojOUI1OUI2O3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMDUyMkQ7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik04IDdWM3MxNiA0VjNtLTkgOGgxME01IDIxaDE0YTIgMiAwIDAgMCAyLTJWN2EyIDIgMCAwIDAtMi0ySDUgYTIgMiAwIDAgMC0yIDJ2MTJhMiAyIDAgMCAwIDIgMnoiLz4KPC9zdmc+Cjwvc3ZnPgo=',
      detailsLink: '#',
    },
    {
      id: '3',
      title: 'Augusta Regional Meeting',
      date: 'February 1, 2025',
      description: 'Successful regional gathering with focus on local physician community.',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojREVCODg3O3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xNyAyMGg1di0yYTMgMyAwIDAgMC01LjM1Ni0xLjg1N00xNyAyMEg3bTEwIDB2LTJjMC0uNjU2LS4xMjYtMS4yODMtLjM1Ni0xLjg1N20wIDBhNS4wMDIgNS4wMDIgMCAwIDEgOS4yODggME0xNSA3YTMgMyAwIDExLTYgMCAzIDMgMCAwMTYgMHptNiAzYTIgMiAwIDExLTQgMCAyIDIgMCAwMTQgMHpNNyAxMGEyIDIgMCAxMS00IDAgMiAyIDAgMDE0IDB6Ii8+Cjwvc3ZnPgo8L3N2Zz4K',
      detailsLink: '#',
    },
    {
      id: '4',
      title: 'Greater Atlanta Regional Meeting 2024',
      date: 'December 7, 2024',
      description: 'Holiday themed event with festive celebrations and community bonding.',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRjVGNUIwO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xMiA2djZsNCA0IDQtNHYtNkgxMnoiLz4KPC9zdmc+Cjwvc3ZnPgo=',
      detailsLink: '#',
    },
  ];

  // Recent news data
  const recentNews = [
    {
      id: '1',
      title: 'GAPI Annual 2025 – CME Schedule',
      date: '2025-05-08',
      excerpt: '36th GAPI Annual Convention and Scientific Session July 18-20, 2025 CME Schedule Saturday July 19th 2025...',
      content: 'Full CME schedule and details for the annual convention...',
      category: 'member-news' as const,
      featured: true,
      author: 'GAPI Education Committee',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xMiA2djZsNCA0IDQtNHYtNkgxMnoiLz4KPC9zdmc+Cjwvc3ZnPgo='
    },
    {
      id: '2',
      title: 'GAPI Annual 2025 Performances',
      date: '2025-05-08',
      excerpt: 'Friday Physician Singers: Dr. Anu Bhat, Dr. Raj Alappan, Dr. Shyalaja Prabhakar, Dr. Sreekala Satheesh, Dr Vijay...',
      content: 'Details about the physician performances at the annual convention...',
      category: 'member-news' as const,
      author: 'GAPI Cultural Committee',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojOUI1OUI2O3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiNBMDUyMkQ7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xMiAyMGMtNC40MSAwLTgtMy41OS04LThzMy41OS04IDgtOCA4IDMuNTkgOCA4LTMuNTkgOC04IDh6bTAtMTRjLTMuMzEgMC02IDIuNjktNiA2czIuNjkgNiA2IDYgNi0yLjY5IDYtNi0yLjY5LTYtNi02eiIvPgo8L3N2Zz4KPC9zdmc+Cg=='
    },
    {
      id: '3',
      title: 'GAPI Annual 2025 Fashion Show Physicians – Tribute to India\'s Weavers',
      date: '2025-05-08',
      excerpt: 'Physician-Themed Indian Fashion Show – A Tribute to India\'s Weavers by Georgia\'s Physicians: An elegant celebration of culture, craftsmanship...',
      content: 'Details about the fashion show celebrating Indian culture and craftsmanship...',
      category: 'member-news' as const,
      author: 'GAPI Cultural Committee',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojREVCODg3O3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xMiAyMGMtNC40MSAwLTgtMy41OS04LTggczMuNTktOCA4LTggOCAzLjU5IDggOC0zLjU5IDgtOCA4em0wLTE0Yy0zLjMxIDAtNiAyLjY5LTYgNnMyLjY5IDYgNiA2IDYtMi42OSA2LTYtMi42OS02LTYtNnoiLz4KPC9zdmc+Cjwvc3ZnPgo='
    },
    {
      id: '4',
      title: 'Sai Health Fair Free Health checkup and testing Apr 2025',
      date: '2025-05-01',
      excerpt: 'Dr. Sujatha Reddy led the Sai Health Fair today with great success. Over 50 individuals received osteoporosis...',
      content: 'Complete report on the successful health fair and community outreach...',
      category: 'member-news' as const,
      author: 'Dr. Sujatha Reddy',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojRjVGNUIwO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xOS4xNCAxMi45NGMuMzk4LS4zOTguMzk4LTEuMDQgMC0xLjQzOEwxMy4xNCA1LjU0Yy0uMzk4LS4zOTgtMS4wNC0uMzk4LTEuNDM4IDBsLTEuNDM4IDEuNDM4Yy0uMzk4LjM5OC0uMzk4IDEuMDQgMCAxLjQzOEwxMS43MiA5bC0xLjQzOCAxLjQzOGMtLjM5OC4zOTgtLjM5OCAxLjA0IDAgMS40MzhsMS40MzggMS40MzhjLjM5OC4zOTggMS4wNC4zOTggMS40MzggMEwxMy4xNCAxMi40NmwxLjQzOCAxLjQzOGMuMzk4LjM5OCAxLjA0LjM5OCAxLjQzOCAwbDEuNDM4LTEuNDM4Yy4zOTgtLjM5OC4zOTgtMS4wNCAwLTEuNDM4TDE1LjI4IDlsMS40MzgtMS40MzhjLjM5OC0uMzk4LjM5OC0xLjA0IDAtMS40Mzh6Ii8+Cjwvc3ZnPgo8L3N2Zz4K'
    },
    {
      id: '5',
      title: 'New Membership Benefits Announced',
      date: '2025-04-28',
      excerpt: 'Enhanced benefits including expanded CME opportunities and networking events for all GAPI members.',
      content: 'Full details of new membership benefits and opportunities...',
      category: 'announcement' as const,
      author: 'GAPI Membership Team',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xMiAyMGMtNC40MSAwLTgtMy41OS04LTggczMuNTktOCA4LTggOCAzLjU5IDggOC0zLjU5IDgtOCA4em0wLTE0Yy0zLjMxIDAtNiAyLjY5LTYgNnMyLjY5IDYgNiA2IDYtMi42OSA2LTYtMi42OS02LTYtNnoiLz4KPC9zdmc+Cjwvc3ZnPgo='
    },
    {
      id: '6',
      title: 'GAPI Partners with Local Hospitals for Community Health Initiative',
      date: '2025-04-25',
      excerpt: 'New partnership program to improve healthcare access in underserved communities across Georgia.',
      content: 'Details about the new community health partnership...',
      category: 'news' as const,
      author: 'GAPI Board',
      imageUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSJ1cmwoI2dyYWRpZW50KSIvPgo8ZGVmcz4KPGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudCIgeDE9IjAiIHkxPSIwIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdHlsZT0ic3RvcC1jb2xvcjojQTA1MjJEO3N0b3Atb3BhY2l0eToxIiAvPgo8c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiM2NTQzMjE7c3RvcC1vcGFjaXR5OjEiIC8+CjwvbGluZWFyR3JhZGllbnQ+CjwvZGVmcz4KPHN2ZyB4PSI1MCUiIHk9IjUwJSIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoLTUwJSwtNTAlKSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuMyIgdmlld0JveD0iMCAwIDI0IDI0Ij4KPHBhdGggc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBzdHJva2Utd2lkdGg9IjIiIGQ9Ik0xMiAyMGMtNC40MSAwLTgtMy41OS04LTggczMuNTktOCA4LTggOCAzLjU5IDggOC0zLjU5IDgtOCA4em0wLTE0Yy0zLjMxIDAtNiAyLjY5LTYgNnMyLjY5IDYgNiA2IDYtMi42OSA2LTYtMi42OS02LTYtNnoiLz4KPC9zdmc+Cjwvc3ZnPgo='
    }
  ];

  return (
    <div className="bg-brand-cream min-h-screen">
      {/* Hero Section */}
      <HeroSection />

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left Column - Events & News */}
          <div className="lg:col-span-2 space-y-8">
            {/* Upcoming Events - Compact */}
            <section className="bg-white rounded-lg shadow-sm border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <h2 className="text-xl font-bold text-neutral-dark">
                  Upcoming Events
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {upcomingEvents.slice(0, 3).map((event) => (
                    <div key={event.id} className="flex items-start space-x-4 p-4 bg-neutral-light/30 rounded-lg">
                      <div className="flex-shrink-0 w-16 text-center">
                        <div className="text-sm font-semibold text-gold">{event.date}</div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-neutral-dark text-base mb-1 line-clamp-2">
                          {event.title}
                        </h3>
                        <p className="text-sm text-neutral-dark/70 line-clamp-2">
                          {event.description}
                        </p>
                        {event.location && (
                          <p className="text-sm text-gold mt-1">{event.location}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <Link to="/events" className="text-base text-red hover:text-neutral-dark font-semibold">
                    View All Events →
                  </Link>
                </div>
              </div>
            </section>

            {/* Recent Past Events Section */}
            <section className="bg-white rounded-lg shadow-sm border border-neutral-light">
              <div className="p-6 border-b border-neutral-light">
                <h2 className="text-xl font-bold text-neutral-dark">
                  Recent Past Events
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {pastEvents.slice(0, 3).map((event) => (
                    <Link key={event.id} to={event.detailsLink} className="block">
                      <div className="flex items-start space-x-4 p-4 hover:bg-neutral-light/30 rounded-lg transition-colors cursor-pointer">
                        <div className="flex-shrink-0 flex flex-col items-center">
                          <img 
                            src={event.imageUrl} 
                            alt={`${event.title} event`}
                            className="w-24 h-18 object-cover rounded-lg shadow-sm mb-2"
                            onError={(e) => {
                              // Fallback if image fails to load
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          <div className="text-xs font-medium text-sand text-center">
                            {new Date(event.date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-neutral-dark text-base mb-2 line-clamp-2">
                            {event.title}
                          </h3>
                          <p className="text-sm text-neutral-dark/70 line-clamp-2">
                            {event.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 text-center">
                  <Link to="/events" className="text-base text-red hover:text-neutral-dark font-semibold">
                    View All Past Events →
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* Right Column - Quick Info & CTA */}
          <div className="space-y-6">


            {/* Quick Actions */}
            <section className="bg-white rounded-lg shadow-sm border border-neutral-light p-6">
              <h3 className="text-lg font-bold text-neutral-dark mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  to="/become-a-member"
                  className="block w-full bg-red text-white text-center py-3 px-4 rounded-lg font-semibold hover:bg-neutral-dark transition-colors"
                >
                  Become a Member
                </Link>
                <Link
                  to="/contact"
                  className="block w-full border border-red text-red text-center py-3 px-4 rounded-lg font-semibold hover:bg-red hover:text-white transition-colors"
                >
                  Contact Us
                </Link>
                <Link
                  to="/about"
                  className="block w-full border border-neutral-light text-neutral-dark text-center py-3 px-4 rounded-lg font-semibold hover:bg-neutral-light transition-colors"
                >
                  About GAPI
                </Link>
              </div>
            </section>

            {/* Newsletter Signup */}
            <section>
              <NewsletterSignup variant="card" source="homepage" />
            </section>


          </div>
        </div>

        {/* Image Carousel Section */}
        <section className="mt-8 bg-white rounded-lg shadow-sm border border-neutral-light p-6">
          <h2 className="text-xl font-bold text-neutral-dark mb-4">
            GAPI in Action
          </h2>
          {loading ? (
            <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
              <div className="text-center text-gray-600">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red mx-auto mb-4"></div>
                <p>Loading images...</p>
              </div>
            </div>
          ) : (
            <EventImageCarousel images={carouselImages} />
          )}
        </section>

        {/* Latest News Section */}
        <section className="mt-8">
          <HomeNewsSection news={recentNews} />
        </section>
      </div>

      {/* Sponsor Section */}
      <SponsorSection />
    </div>
  );
} 