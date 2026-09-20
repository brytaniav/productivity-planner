# Daydream Planner

A shared productivity planner for two people, with a warm comic-strip look.

## Run

Requires Node.js 18 or later. No packages to install.

```bash
npm start
```

Place your Firebase service account JSON at `secret/service_account.json`, or set `GOOGLE_APPLICATION_CREDENTIALS` to its path. The account needs access to the Firestore database named `tasks`; set `FIRESTORE_DATABASE_ID` if yours has another name. Then open <http://localhost:3000>. To use it together on the same network, open `http://<your-computer-ip>:3000` on the second device. Tasks are stored in the Firestore `tasks` collection. Keep the service account file private.

The **Today** view suggests up to five tasks per person: normally two high, two medium, and one low priority. Tasks due today, overdue, or due within the next two days fill slots first even if that changes the mix. Remaining slots follow the priority mix; if a category has too few tasks, the nearest remaining deadlines fill the gaps. New urgent tasks can replace early suggestions. Unfinished tasks are considered again tomorrow without changing their actual deadlines. Tasks completed today stay visible for the day and count toward the progress card; **All tasks** always shows the full collection. The calendar shows task names on their due dates. Views refresh every 15 seconds, and the theme button remembers your light or dark mode preference.

The **Tracker** tab compares the number of tasks each person completed on each of the last seven days. It also shows each person's weekly completions, open tasks, and overall completion rate (completed divided by currently assigned tasks). The graph uses the current task records and their most recent completion timestamps; deleting a task or marking it incomplete removes it from these totals.

This is a small trusted-pair app with no login. Do not expose the server directly to the public internet.
