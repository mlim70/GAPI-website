# Website Maintenance Mode

This document explains how to use the simplified maintenance mode system to temporarily make your website inaccessible to the public.

## How It Works

The maintenance mode system is now very simple:
- **Maintenance Mode**: Shows an "Under Construction" page for all routes
- **Normal Mode**: Shows your full website functionality

## Quick Start

### To Enable Maintenance Mode (Block Public Access)

Currently active! The website is already showing the Under Construction page for all routes.

### To Disable Maintenance Mode (Restore Website)

1. Open `frontend/src/App.tsx`
2. Replace the current `AppContent` function with the normal website routing:

```tsx
function AppContent({ user, setUser, logout }: { user: any; setUser: (user: any) => void; logout: () => void }) {
  const location = useLocation();
  
  // Scroll to top of page
  useScrollToTop();
  
  // Normal website functionality
  return (
    <div className="overflow-x-hidden bg-[#FBFBF0] min-h-screen flex flex-col">
      <NavBar user={user} logout={logout} />
      <main className="pt-16 flex-grow">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/about/students-residents" element={<StudentsResidents />} />
          <Route path="/clinic" element={<Clinic />} />
          <Route path="/news" element={<News />} />
          <Route path="/events" element={<Events />} />
          <Route path="/become-a-member" element={<BecomeMember user={user} setUser={setUser} />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/login" element={<Login setUser={setUser} />} />
          <Route path="/account" element={user ? <Account setUser={setUser} /> : <Login setUser={setUser} />} />
          <Route path="/email-verification" element={<EmailVerification />} />
          <Route path="/stripe/success" element={<StripeSuccess setUser={setUser} />} />
          <Route path="/stripe/cancel" element={<StripeCancel />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
```

3. Deploy your changes

## What Users See

When maintenance mode is active:
- All routes (`/`, `/about`, `/login`, etc.) show the Under Construction page
- Users cannot access any part of your website
- Professional, friendly message explaining the situation
- Contact information for urgent inquiries
- Clean, modern design that maintains your brand image

## Benefits

1. **Simple Implementation**: No configuration files to manage
2. **Professional Appearance**: Maintains brand image during downtime
3. **User-Friendly**: Clear communication about what's happening
4. **Contact Information**: Users can still reach you if needed
5. **Easy to Toggle**: Just swap the routing logic in App.tsx

## Deployment

After changing the routing logic:

1. Commit your changes
2. Push to your repository
3. Deploy to your hosting platform
4. The change will take effect immediately

## Customization

You can customize the Under Construction page by editing:
- `frontend/src/pages/UnderConstruction.tsx` - Page content and styling

## Security Note

This system only affects the frontend. If you need to completely block access to your backend API, you'll need to implement additional measures at the server level.

## Troubleshooting

- **Page not updating**: Clear browser cache or hard refresh
- **Still showing old content**: Check if your deployment completed successfully
- **Console errors**: Verify the App.tsx syntax after changes

## Support

If you encounter issues with the maintenance mode system, check:
1. App.tsx syntax after making changes
2. Deployment status
3. Browser console for any error messages
