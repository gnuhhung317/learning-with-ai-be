const express = require('express');
const { randomUUID } = require('crypto');
const { quizGroups } = require('../data/store');

const router = express.Router();

// Create group
router.post('/', (req, res) => {
  const { name, description = '' } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const id = randomUUID();
  const group = { id, name, description };
  quizGroups.set(id, group);
  res.status(201).json(group);
});

// List groups
router.get('/', (req, res) => {
  res.json(Array.from(quizGroups.values()));
});

// Get group by id
router.get('/:id', (req, res) => {
  const group = quizGroups.get(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  res.json(group);
});

// Update group
router.patch('/:id', (req, res) => {
  const group = quizGroups.get(req.params.id);
  if (!group) {
    return res.status(404).json({ error: 'Group not found' });
  }
  const { name, description } = req.body;
  if (name !== undefined) group.name = name;
  if (description !== undefined) group.description = description;
  res.json(group);
});

// Delete group
router.delete('/:id', (req, res) => {
  if (!quizGroups.has(req.params.id)) {
    return res.status(404).json({ error: 'Group not found' });
  }
  quizGroups.delete(req.params.id);
  res.status(204).end();
});

module.exports = router;
