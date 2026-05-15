<div align="center">
  <img width="1200" height="475" alt="SprintRoom Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# SprintRoom

SprintRoom is a focused execution platform designed to help teams and individuals build weekly rhythms, stay in sync, and eliminate blockers.

## Features
- **Weekly Rhythms**: Plan and reflect on your week.
- **Focus Sessions**: Timed pomodoro sessions to get deep work done.
- **Task Management**: Simple task tracking with blockers and due dates.
- **Real-Time Collaboration**: Pulse updates from your team.

---

## Local Setup

**Prerequisites:** Node.js (v18+) and Supabase CLI installed.

1. **Clone and Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env` file at the root. You can copy the structure from `.env.example`.
   Required keys:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY` (for AI suggestions)
   - `NEXT_PUBLIC_SITE_URL`

3. **Supabase Local Setup**
   Ensure Docker is running, then start your local Supabase instance:
   ```bash
   supabase start
   ```
   This will automatically apply all migrations in `supabase/migrations/` to your local database.

4. **Run the App**
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`.

---

## Tests & CI/CD
We use GitHub Actions for continuous integration.
To run checks locally:
```bash
npm run lint
npm run build
```
To validate Supabase migrations:
```bash
supabase db lint
```

## Deployment
SprintRoom is built with Next.js and Supabase.
1. Deploy your database by running migrations against your production Supabase project:
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```
2. Deploy the frontend to Vercel (or your preferred Next.js hosting). Ensure all environment variables from `.env.example` are set in your production environment.
