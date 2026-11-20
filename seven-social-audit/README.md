# SEVEN social media register

A public-view capture of the social accounts of SEVEN (Saudi Entertainment Ventures), made 19–20 Nov 2026, with a marketing assessment.

- `ASSESSMENT.md`: the social media and marketing assessment.
- `data/register.csv` and `data/register.json`: one row per post (71). Each row has the platform, date (and whether it's exact or approximate), format, caption, hashtags, language, views, likes, comments, shares, URL and the screenshot path.
- `screenshots/youtube/`: the thumbnail of each video.
- `screenshots/tiktok/`: each video, rendered in TikTok's official embed player.
- `screenshots/snapchat/`: each Spotlight post's page.
- `screenshots/profiles/`: the profile and header pages, including the login walls that blocked Instagram and Facebook.

How it was collected: a headless Chromium browser loaded each public page logged out, and nothing was bypassed. Some sources were used where a profile page wasn't usable:
- TikTok: the public creator embed and the embed player.
- YouTube: the public channel RSS feed, which gives exact dates and likes for the 15 most recent uploads.

X and LinkedIn refused automated access. Instagram and Facebook require a login. Their posts are therefore not in the register (see ASSESSMENT.md §7).
