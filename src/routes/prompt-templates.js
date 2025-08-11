const express = require('express');
const { randomUUID } = require('crypto');
const { promptTemplates } = require('../data/store');

const router = express.Router();

// Create template
router.post('/', (req, res) => {
  const { name, description = '', category = '', templateString = '', metadata = {} } = req.body;
  if (!name || !templateString) {
    return res.status(400).json({ error: 'name and templateString are required' });
  }
  const id = randomUUID();
  const template = { id, name, description, category, templateString, metadata };
  promptTemplates.set(id, template);
  res.status(201).json(template);
});

// List templates
router.get('/', (req, res) => {
  res.json(Array.from(promptTemplates.values()));
});

// Update template
router.patch('/:id', (req, res) => {
  const template = promptTemplates.get(req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  const { name, description, category, templateString, metadata } = req.body;
  if (name !== undefined) template.name = name;
  if (description !== undefined) template.description = description;
  if (category !== undefined) template.category = category;
  if (templateString !== undefined) template.templateString = templateString;
  if (metadata !== undefined) template.metadata = metadata;
  res.json(template);
});

// Delete template
router.delete('/:id', (req, res) => {
  if (!promptTemplates.has(req.params.id)) {
    return res.status(404).json({ error: 'Template not found' });
  }
  promptTemplates.delete(req.params.id);
  res.status(204).end();
});

module.exports = router;
