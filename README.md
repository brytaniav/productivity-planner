# Daydream Planner

A shared productivity planner for two people, with a warm comic-strip look.

## Run

Requires Node.js 18 or later. No packages to install.

```bash
npm start
```

Open <http://localhost:3000>. To use it together on the same network, open `http://<your-computer-ip>:3000` on the second device. Tasks are saved in `data/tasks.json` on the computer running the server.

The **Today** view shows every task, ranked by priority and due date. The progress card counts completed tasks out of all tasks assigned to Snoopy and Charlie Brown, including tasks with future due dates. The calendar shows task names on their due dates. Both views refresh every 15 seconds, and the theme button remembers your light or dark mode preference.

This is a small trusted-pair app with no login. Do not expose the server directly to the public internet.
