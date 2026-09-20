# Daydream Planner

A shared productivity planner for two people, with a warm comic-strip look.

## Run

Requires Node.js 18 or later. No packages to install.

```bash
npm start
```

Place your Firebase service account JSON at `secret/service_account.json`, or set `GOOGLE_APPLICATION_CREDENTIALS` to its path. The account needs access to the Firestore database named `tasks`; set `FIRESTORE_DATABASE_ID` if yours has another name. Then open <http://localhost:3000>. To use it together on the same network, open `http://<your-computer-ip>:3000` on the second device. Tasks are stored in the Firestore `tasks` collection. Keep the service account file private.

The **Today** view shows every task, ranked by priority and due date. The progress card counts completed tasks out of all tasks assigned to Snoopy and Charlie Brown, including tasks with future due dates. The calendar shows task names on their due dates. Both views refresh every 15 seconds, and the theme button remembers your light or dark mode preference.

This is a small trusted-pair app with no login. Do not expose the server directly to the public internet.
