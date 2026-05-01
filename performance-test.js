import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp-up to 20 users
    { duration: '1m', target: 20 },  // stay at 20 users
    { duration: '30s', target: 0 },  // ramp-down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
  },
};

const BASE_URL = 'http://localhost:5000/api';

export default function () {
  // Test get products
  const productRes = http.get(`${BASE_URL}/products`);
  check(productRes, { 'get products status is 200': (r) => r.status === 200 });

  sleep(1);

  // Test get popular products
  const popularRes = http.get(`${BASE_URL}/products/popular`);
  check(popularRes, { 'get popular products status is 200': (r) => r.status === 200 });

  sleep(1);
}
