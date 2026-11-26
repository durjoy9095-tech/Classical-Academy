# Classical Academy (ক্লাসিক্যাল একাডেমি)

Bengali e-learning platform for Classes 6–10. Static front-end (no build step) + Supabase backend. Deploys directly on Cloudflare Pages.

## 1. Supabase setup
1. Create a project at supabase.com.
2. **SQL Editor** → paste all of `supabase/schema.sql` → **Run** (tables, RLS, RPCs, storage buckets).
3. **Authentication → Providers → Email**: keep *Confirm email* **ON** (required email verification).
4. **Authentication → URL Configuration**: set *Site URL* to your final domain (e.g. `https://classicalacademy.com`) and add it, plus `https://<project>.pages.dev` and `http://localhost:8099`, to *Redirect URLs*.
5. **Google Sign-In** (optional): Authentication → Providers → Google; create OAuth credentials in Google Cloud Console with the callback URL Supabase shows. Set `ENABLE_GOOGLE = false` in `js/config.js` to hide the button.
6. **Project Settings → API**: copy *Project URL* and the **anon public** key into `js/config.js`. Never use the `service_role` key.
7. Register in the app, verify your email, then in SQL Editor run:
   `update public.profiles set role = 'super_admin' where email = 'you@example.com';`
   After that, manage all other roles from **Admin → ব্যবহারকারী**.

## 2. Run locally
`python3 -m http.server 8099` in this folder, open http://localhost:8099

## 3. Deploy to Cloudflare Pages
1. Push this folder to a GitHub repository.
2. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → pick the repo.
3. Framework preset: **None**; build command: *(empty)*; output directory: `/`.
4. Deploy. Every push to the main branch redeploys automatically; SSL is free.
5. Custom domain: Pages project → Custom domains → add your domain and follow the DNS prompt.
6. Add the final domain to Supabase *Redirect URLs* (step 4 above).

## 4. First steps as Super Admin
Admin → সাইট সেটিংস (bKash/Nagad/Rocket numbers) → বিষয় (subjects) → শিক্ষক → কোর্স → পাঠ → পরীক্ষা/প্রশ্ন → বই/স্টোর → ওয়েলকাম পেজ.

## Notes
- Payments are manual (bKash/Nagad/Rocket TrxID) and verified by an admin under **অর্ডার**; a gateway can replace `checkout()` later.
- Biometric login is a device app-lock (WebAuthn); AI Tutor is a "coming soon" page.
- Offline content is stored per device in browser Cache Storage.
- Security headers/CSP are in `_headers`. If you add other external hosts, update the CSP.
- `tests/` holds a mock-backed smoke test (`node tests/smoke.cjs` with a local server on :8099 and Playwright); it is not needed in production.
