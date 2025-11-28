Skill Quiz & Badge API

Routes (admin):
- POST `/api/admin/quizzes` - create quiz
- GET `/api/admin/quizzes` - list quizzes
- GET `/api/admin/quizzes/:id` - quiz detail
- PUT `/api/admin/quizzes/:id` - update quiz
- DELETE `/api/admin/quizzes/:id` - delete quiz
- GET `/api/admin/quizzes/:id/stats` - quiz stats
- POST `/api/admin/quizzes/badges` - create badge

Public / authenticated:
- GET `/api/quizzes` - list quizzes (filter `?skill=`)
- GET `/api/quizzes/:id` - get quiz (no correct answers)
- POST `/api/quizzes/:id/attempt` - submit attempt (requires session auth)
- GET `/api/quizzes/users/:userId/attempts` - list attempts for user (self)
- GET `/api/quizzes/users/:userId/badges` - list badges for user (self)

Seed:
- `node seeds/seedQuizzes.js` will create one sample quiz and badge.

Notes:
- Ensure `MONGO_URI` is set in environment or the script will try `mongodb://localhost:27017/milestone`.
- Admin routes are protected by existing `requireAdmin` middleware in `adminRoutes.js`.
