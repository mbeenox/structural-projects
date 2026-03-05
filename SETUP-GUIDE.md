# Structural Projects — Deployment Guide

This guide walks you through getting your project management app online with a real database. Everything uses free tiers — no credit card required.

---

## Overview

You'll set up two free services:

| Service | What it does | Free tier |
|---------|-------------|-----------|
| **Supabase** | Database (stores your projects) | 500 MB, 50K requests/month |
| **Vercel** | Hosts the website | Unlimited for personal use |

**Total time: ~20 minutes**

---

## Step 1: Set Up the Database (Supabase)

1. Go to [supabase.com](https://supabase.com) and click **Start your project**
2. Sign up with your **GitHub account** (create one at github.com if needed — it's free)
3. Click **New Project**
   - **Name**: `structural-projects`
   - **Database Password**: pick something strong (save it somewhere)
   - **Region**: choose the closest to you (e.g. US East)
   - Click **Create new project** — wait ~2 minutes for it to spin up

4. Once ready, go to **SQL Editor** in the left sidebar
5. Click **New query**
6. Open the file `supabase/setup.sql` from the project folder
7. **Copy the entire contents** and paste it into the SQL editor
8. Click **Run** (the green play button)
9. You should see "Success. No rows returned" — that's perfect!

### Get your API keys

10. Go to **Settings** (gear icon) → **API** in the left sidebar
11. Copy these two values (you'll need them in Step 3):
    - **Project URL** (looks like `https://abcdefgh.supabase.co`)
    - **anon / public** key (the long string under "Project API keys")

---

## Step 2: Push Code to GitHub

1. Go to [github.com](https://github.com) (log in with the account you created)
2. Click the **+** icon → **New repository**
   - **Name**: `structural-projects`
   - Keep it **Public** or **Private** (your choice)
   - Click **Create repository**

3. On your computer, open a terminal/command prompt in the project folder and run:

```
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/structural-projects.git
git push -u origin main
```

*(Replace `YOUR_USERNAME` with your actual GitHub username)*

> **Don't have Git?** Download it from [git-scm.com](https://git-scm.com/downloads)

---

## Step 3: Deploy to Vercel (Free Hosting)

1. Go to [vercel.com](https://vercel.com) and sign up with **GitHub**
2. Click **Add New** → **Project**
3. Find and select your `structural-projects` repository
4. Before clicking Deploy, expand **Environment Variables** and add:

   | Key | Value |
   |-----|-------|
   | `VITE_SUPABASE_URL` | Your Project URL from Step 1 |
   | `VITE_SUPABASE_ANON_KEY` | Your anon key from Step 1 |

5. Click **Deploy** — wait ~1 minute
6. **Done!** Vercel gives you a URL like `structural-projects.vercel.app`

---

## Using Your App

- Visit your Vercel URL from any device — phone, tablet, or computer
- **Add projects**: Click the gold "Add Project" button
- **Edit projects**: Click the pencil icon on any row
- **Delete projects**: Click the trash icon on any row
- **Search & filter**: Use the search bar and dropdown filters
- **Notifications**: Click the bell icon to see upcoming deadlines, then click "Notify" to send reminders
- **Dashboard**: Toggle between Table and Dashboard views
- All changes are saved instantly to your database

---

## Updating the App Later

If you make changes to the code:

```
git add .
git commit -m "Updated the app"
git push
```

Vercel automatically rebuilds and deploys within ~30 seconds.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| "Failed to load projects" | Check that your Supabase URL and key are correct in Vercel's environment variables |
| Blank page | Open browser console (F12) and check for errors |
| Can't push to GitHub | Make sure Git is installed and you're logged in (`git config --global user.name "Your Name"`) |
| Projects not saving | Make sure you ran the full SQL setup script (Step 1, items 4-9) |

---

## Optional: Custom Domain

If you want a custom URL like `projects.yourcompany.com`:
1. In Vercel, go to your project → **Settings** → **Domains**
2. Add your domain and follow the DNS instructions

---

## Need Help?

Feel free to ask me anytime — I can help troubleshoot, add features (like email notifications, user logins, Excel export, etc.), or customize the design.
