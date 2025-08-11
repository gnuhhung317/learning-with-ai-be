# Backend API Reference

Base URL: `/api`

## Quizzes

### POST /quizzes
Create a new quiz.

**Request Body**
```json
{
  "title": "Algebra Basics",
  "description": "Introductory algebra quiz",
  "groupId": "optional-group-id",
  "tags": ["math", "algebra"]
}
```

**Response** `201`
```json
{
  "id": "<uuid>",
  "title": "Algebra Basics",
  "description": "Introductory algebra quiz",
  "groupId": "optional-group-id",
  "tags": ["math", "algebra"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "questions": []
}
```

### GET /quizzes?group=GROUP_ID
List all quizzes, optionally filtered by group.

**Response** `200`
```json
[
  {
    "id": "<uuid>",
    "title": "Algebra Basics",
    "description": "Introductory algebra quiz",
    "groupId": "optional-group-id",
    "tags": ["math", "algebra"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "questions": []
  }
]
```

### GET /quizzes/{id}
Retrieve a quiz by id.

### PATCH /quizzes/{id}
Update quiz metadata (`title`, `description`, `groupId`, `tags`).

### DELETE /quizzes/{id}
Remove a quiz and its questions.

### POST /quizzes/{quizId}/questions
Add a question to a quiz.

**Request Body**
```json
{
  "questionText": "2 + 2 = ?",
  "options": ["3", "4", "5"],
  "correctAnswer": 1,
  "explanation": "Basic addition",
  "promptType": "multiple-choice"
}
```

### GET /quizzes/{quizId}/questions
List questions for a quiz.

## Questions

### PATCH /questions/{id}
Edit question text, options, correct answer, explanation, or prompt type.

### DELETE /questions/{id}
Remove a question.

## Prompt Templates

### POST /prompt-templates
Create a prompt template.

### GET /prompt-templates
List all prompt templates.

### PATCH /prompt-templates/{id}
Update a prompt template.

### DELETE /prompt-templates/{id}
Remove a prompt template.

## Groups

### POST /groups
Create a quiz group.

### GET /groups
List all quiz groups.

### GET /groups/{id}
Fetch a group by id.

### PATCH /groups/{id}
Update group name or description.

### DELETE /groups/{id}
Delete a group.

## Quiz Generation

### POST /quiz
Generate questions from a text topic.

**Request Body**
```json
{
  "topic": "world history",
  "level": "beginner",
  "numberOfQuestions": 5
}
```

### POST /quiz/pdf
Generate questions from an uploaded PDF. Send a multipart/form-data request with `file`, `numberOfQuestions`, and `level` fields.

### POST /quiz/pdf/generate
Create a PDF from supplied questions. Set `type` to `quiz` for questions only or `answers` for answer sheet.

## Notes
- Data is stored in-memory; restarting the server clears all quizzes and related entities.
- All endpoints return JSON responses unless generating a PDF.
