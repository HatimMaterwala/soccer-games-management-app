# League website: setup guide

This folder is the complete website. It works right away in **demo mode** (sample data, saved only in your own browser, coach password `coach`). To make it real, so that every parent sees the same data and coaches can edit it, connect a free Supabase database and put the site online. It takes about 15 minutes.

## What's in the folder

| File | What it is |
|---|---|
| `index.html`, `app.js`, `styles.css` | The website |
| `config.js` | The only file you edit: your database keys go here |
| `schema.sql` | Creates the database tables and security rules |
| `vendor/supabase.js` | The database library (no need to touch it) |
| `icon.svg`, `manifest.json` | Home-screen icon for phones |

## Step 1: Create the database (free)

1. Go to **supabase.com** and sign in. Click **New project**.
2. Pick a name (for example `soccer-league`), set a database password and save it somewhere, and choose the region closest to you (for example *Canada (Central)*). Click **Create**.
3. When it's ready, open **SQL Editor**, click **New query**, paste everything from `schema.sql`, and click **Run**. You should see "Success".

## Step 2: Add coach logins and lock sign-ups

1. Go to **Authentication → Users → Add user → Create new user**. Enter the coach's email and a password, and tick **Auto Confirm User**. Repeat this for each coach (Mohamed first).
2. **Important:** go to **Authentication → Sign In / Providers** (on older dashboards it's under Settings) and turn **off** "Allow new users to sign up". Only people you add yourself can edit the site.

## Step 3: Connect the website to the database

1. In Supabase, open **Project Settings → API** (or **Data API / API Keys**).
2. Copy the **Project URL** and the **anon public** key.
3. Open `config.js` in Notepad and paste them between the quotes:

```js
window.LEAGUE_CONFIG = {
  supabaseUrl: 'https://abcdefgh.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...'
};
```

The anon key is meant to be public. The security rules from `schema.sql` make sure parents can only read, and only signed-in coaches can make changes or see payments.

## Step 4: Put it online (free)

1. Go to **app.netlify.com/drop** and sign in, so you can update the site later.
2. Drag this whole folder onto the page. Netlify gives you a link like `random-name.netlify.app`.
3. Under **Site configuration → Change site name**, rename it, for example `northside-soccer.netlify.app`.
4. Send that link to parents. On a phone they can tap **Share → Add to Home Screen** to get an app icon.

To update the site later: open the site in Netlify, go to **Deploys**, and drag the folder in again.

## Step 5: Fill it in

Open the site, tap **Coaches**, and sign in with a coach email and password. Then:

1. **Settings:** set the league name, season, fee and welcome message.
2. **Teams:** add each age group with its coach and usual practice time.
3. **Players:** add the kids, with jersey number, position, ratings and parent contact. Parent contact is private.
4. **Schedule:** add practices (use **Repeat weekly** to add a whole season at once) and games. After a game, edit it and add the result, like `W 3-1`.
5. **News:** post announcements. Pin the important ones.
6. **Payments:** tap **Mark paid** or **Edit** to record partial payments. **Copy who still owes** copies a list you can paste into a group chat.

## Privacy notes

- Parents see players' first names and last initials only. You can change this under **Settings**.
- Payments, parent names and phone numbers are visible only to signed-in coaches.
- Supabase's free tier pauses a project after a week with no visitors. If that happens, open supabase.com and click **Restore**. A league site that parents visit every week won't hit this.
