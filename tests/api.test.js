const request = require('supertest');
const app = require('../server'); // надо экспортировать app из server.js, поэтому в server.js нужно добавить module.exports = app;
const db = require('../db');

afterAll((done) => {
    // Закрываем соединение с БД, чтобы Jest завершился
    db.close((err) => {
        if (err) console.error('Ошибка при закрытии БД:', err);
        done();
    });
});

// Увеличим таймаут, если нужно (опционально)
jest.setTimeout(10000);

describe('API тесты', () => {
    test('Создание заявки', async () => {
        const res = await request(app)
            .post('/api/requests')
            .send({
                clientName: 'Тест',
                phone: '123',
                address: 'Адрес',
                problemText: 'Описание'
            });
        expect(res.statusCode).toBe(201);
        expect(res.body).toHaveProperty('id');
    });

    test('Гонка при взятии в работу', async () => {
        // Сначала создадим заявку и назначим мастеру
        const createRes = await request(app)
            .post('/api/requests')
            .send({
                clientName: 'Гонка',
                phone: '456',
                address: 'Улица',
                problemText: 'Проверка'
            });
        const requestId = createRes.body.id;

        // Назначаем мастеру с id=2 (Пётр)
        await request(app)
            .patch(`/api/requests/${requestId}/assign`)
            .send({ masterId: 2 });

        // Два параллельных запроса на take
        const promise1 = request(app)
            .patch(`/api/requests/${requestId}/take`)
            .send({ masterId: 2 });
        const promise2 = request(app)
            .patch(`/api/requests/${requestId}/take`)
            .send({ masterId: 2 });

        const [res1, res2] = await Promise.all([promise1, promise2]);

        // Один должен быть успешным (200), другой с конфликтом (409)
        const ok = res1.statusCode === 200 ? res1 : res2;
        const conflict = res1.statusCode === 409 ? res1 : res2;

        expect(ok.statusCode).toBe(200);
        expect(conflict.statusCode).toBe(409);
    });
});