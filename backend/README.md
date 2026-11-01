# Turning the hub public

Out of the box the hub runs in **local mode**: items live in your own browser. To make it public you connect a free hosted database. About ten minutes, no servers to run.

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough to start).
2. Open **SQL Editor**, paste all of `backend/schema.sql`, and run it. This creates the tables, the security rules (everyone can read, only signed-in people can publish as themselves), a limit of 10 publishes per hour per person, and a safe like counter.
3. Open **Authentication → URL Configuration** and add your site address (for example `https://gigachad-suryansh.github.io/AI-Training-3D/hub.html`) to the redirect URLs. Email sign-in uses a magic link.
4. Open **Project Settings → API** and copy the **Project URL** and the **anon public key**. The anon key is designed to be public; the security rules above are what protect the data.
5. In the GitHub repo go to **Settings → Secrets and variables → Actions → Variables** and add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The deploy workflow passes them to the build.
6. Re-run the **Deploy** workflow. The hub page now says "Public hub".

For local development, put the same two values in a `.env.local` file (it is git-ignored).

Never put the `service_role` key anywhere in this project. It bypasses the security rules.
