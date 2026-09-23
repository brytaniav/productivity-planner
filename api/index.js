const { TaskService, PlannerServer } = require('../server.js');
const { FirestoreTaskRepository } = require('../public/backend/database/firestore-task-repository.js');

let plannerPromise;

function getPlanner() {
  if (!plannerPromise) {
    plannerPromise = FirestoreTaskRepository.fromEnvironment()
      .then(repository => new PlannerServer(new TaskService(repository)));
  }
  return plannerPromise;
}

module.exports = async function handler(req, res) {
  try {
    const rewrittenUrl = new URL(req.url, 'http://localhost');
    const path = rewrittenUrl.searchParams.get('path') || '';
    rewrittenUrl.searchParams.delete('path');
    const query = rewrittenUrl.searchParams.toString();

    req.url = `/api/${path}${query ? `?${query}` : ''}`;
    const planner = await getPlanner();
    return planner.handle(req, res);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(JSON.stringify({ error: 'Server configuration error.' }));
  }
};
