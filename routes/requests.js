const express = require('express');
const db = require('../db');
const router = express.Router();

// Получить все заявки (для диспетчера) с возможностью фильтрации по статусу
router.get('/', (req, res) => {
    const { status, assignedTo } = req.query;
    let sql = "SELECT * FROM requests";
    const params = [];
    const conditions = [];

    if (status) {
        conditions.push("status = ?");
        params.push(status);
    }
    if (assignedTo) {
        conditions.push("assignedTo = ?");
        params.push(assignedTo);
    }

    if (conditions.length) {
        sql += " WHERE " + conditions.join(" AND ");
    }
    sql += " ORDER BY createdAt DESC";

    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// Создать заявку
router.post('/', (req, res) => {
    const { clientName, phone, address, problemText } = req.body;
    if (!clientName || !phone || !address || !problemText) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const sql = `
    INSERT INTO requests (clientName, phone, address, problemText)
    VALUES (?, ?, ?, ?)
  `;
    db.run(sql, [clientName, phone, address, problemText], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID });
    });
});

// Назначить мастера (диспетчер)
router.patch('/:id/assign', (req, res) => {
    const { id } = req.params;
    const { masterId } = req.body;
    if (!masterId) return res.status(400).json({ error: 'masterId обязателен' });

    // Проверяем, что мастер существует и имеет роль master
    db.get("SELECT id FROM users WHERE id = ? AND role = 'master'", [masterId], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(404).json({ error: 'Мастер не найден' });

        // Обновляем статус на assigned и назначаем мастера, только если заявка в статусе new
        const sql = `
      UPDATE requests
      SET status = 'assigned', assignedTo = ?
      WHERE id = ? AND status = 'new'
    `;
        db.run(sql, [masterId, id], function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) {
                return res.status(409).json({ error: 'Заявка уже не в статусе new или не существует' });
            }
            res.json({ success: true });
        });
    });
});

// Отменить заявку (диспетчер)
router.patch('/:id/cancel', (req, res) => {
    const { id } = req.params;
    const sql = `
    UPDATE requests
    SET status = 'canceled'
    WHERE id = ? AND status IN ('new', 'assigned')
  `;
    db.run(sql, [id], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(409).json({ error: 'Нельзя отменить заявку в текущем статусе' });
        }
        res.json({ success: true });
    });
});

// Взять в работу (мастер) — самое важное место с защитой от гонок
router.patch('/:id/take', (req, res) => {
    const { id } = req.params;
    const { masterId } = req.body; // текущий мастер
    if (!masterId) return res.status(400).json({ error: 'masterId обязателен' });

    // Атомарная операция: обновляем только если заявка назначена этому мастеру и статус assigned
    const sql = `
    UPDATE requests
    SET status = 'in_progress'
    WHERE id = ? AND assignedTo = ? AND status = 'assigned'
  `;
    db.run(sql, [id, masterId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            // Причина: либо не та заявка, либо статус уже не assigned, либо мастер другой
            return res.status(409).json({ error: 'Заявка недоступна для взятия (возможно, уже взята другим)' });
        }
        res.json({ success: true });
    });
});

// Завершить заявку (мастер)
router.patch('/:id/complete', (req, res) => {
    const { id } = req.params;
    const { masterId } = req.body;
    if (!masterId) return res.status(400).json({ error: 'masterId обязателен' });

    const sql = `
    UPDATE requests
    SET status = 'done'
    WHERE id = ? AND assignedTo = ? AND status = 'in_progress'
  `;
    db.run(sql, [id, masterId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(409).json({ error: 'Нельзя завершить (не в работе или не ваш мастер)' });
        }
        res.json({ success: true });
    });
});

module.exports = router;