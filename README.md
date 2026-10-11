# Daydream Planner

A shared productivity planner for two people, with a warm comic-strip look.

## Run

Requires Node.js 18 or later. No packages to install.

```bash
npm start
```

Place your Firebase service account JSON at `secret/service_account.json`, or set `GOOGLE_APPLICATION_CREDENTIALS` to its path. The account needs access to the Firestore database named `tasks`; set `FIRESTORE_DATABASE_ID` if yours has another name. Then open <http://localhost:3000>. To use it together on the same network, open `http://<your-computer-ip>:3000` on the second device. Tasks are stored in the Firestore `tasks` collection. Keep the service account file private.

The **Today** view suggests up to five tasks per person: normally two high, two medium, and one low priority. Tasks due today, overdue, or due within the next two days fill slots first even if that changes the mix. Remaining slots follow the priority mix; if a category has too few tasks, the nearest remaining deadlines fill the gaps. New urgent tasks can replace early suggestions. Unfinished tasks are considered again tomorrow without changing their actual deadlines. Tasks completed today stay visible for the day and count toward the progress card; **All tasks** always shows the full collection. The calendar shows task names on their due dates. Views refresh every 15 seconds, and the theme button remembers your light or dark mode preference.

Tasks can include notes and a checklist. Checklist items are completed inside the task card. The sun button manually adds or removes a task from **Today**; the pin button keeps it at the top of Today. Manual and pinned tasks remain there until completed or removed, while the allocator fills the remaining daily slots.

The **Tracker** tab compares the number of tasks each person completed on each of the last seven days. It also shows each person's weekly completions, open tasks, and overall completion rate (completed divided by currently assigned tasks). The graph uses the current task records and their most recent completion timestamps; deleting a task or marking it incomplete removes it from these totals.

The **Schedule** tab stores meetings, classes, appointments, and other timed events for Snoopy, Charlie Brown, or both. Events can happen once or repeat daily, weekly, or monthly through a chosen end date. A weekly event repeats on the weekday of its starting date. It supports month, week, and day views. Today shows each person's remaining events and removes them from the daily strip automatically after their end time. Schedule records are stored in the Firestore `schedules` collection.

This is a small trusted-pair app with no login. Do not expose the server directly to the public internet.
