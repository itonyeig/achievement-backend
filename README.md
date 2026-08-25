# Achievements API

An event-driven NestJS, MongoDB, and Paystack backend for ecommerce
achievements, badges, and ₦300 badge cashbacks.

## Architecture

```text
Purchase persisted
  -> purchase.completed
  -> achievement unlocked
  -> achievement.unlocked
  -> badge unlocked
  -> badge.unlocked
  -> pending Paystack cashback
  -> webhook updates cashback status
```

- `UserModule` handles users and achievement progress.
- `ProductModule` handles products and the startup seed.
- `PurchaseModule` records completed purchases.
- `AchievementModule` processes achievements and badges.
- `PaymentModule` handles Paystack recipients, transfers, and webhooks.

## Assessment assumptions

This implementation uses the following explicit assumptions:

1. The assessment defines `First Purchase` and `5 Purchases`, but its
   `Advanced` example requires eight unlocked achievements. The remaining six
   purchase achievements are assumed to continue in increments of five:

   | Purchase count | Achievement    |
   | -------------: | -------------- |
   |              1 | First Purchase |
   |              5 | 5 Purchases    |
   |             10 | 10 Purchases   |
   |             15 | 15 Purchases   |
   |             20 | 20 Purchases   |
   |             25 | 25 Purchases   |
   |             30 | 30 Purchases   |
   |             35 | 35 Purchases   |

2. All configured achievements belong to one implicit purchase group. Because
   the assessment requires only the next available achievement from each group,
   `next_available_achievements` currently contains at most one name.
3. `Advanced` is the only badge named by the assessment. It is unlocked after
   eight achievements. Before it is unlocked, `current_badge` is `null`; after
   it is unlocked, `next_badge` is `null` because no later badge was specified.
4. `POST /purchases/:productId/:userId` represents a completed purchase. Cart,
   checkout, purchase payment, inventory, authentication, discounts, shipping,
   and quantities are outside this assessment flow.
5. Ten sample products are inserted at application startup only when the
   products collection is empty.
6. User creation uses Paystack's documented Nigerian test transfer details:
   account number `0000000000` and Zenith Bank code `057`. The user's name is
   used as the recipient account name.
7. Cashback is initiated once when a badge is newly persisted. It is stored as
   `pending` before calling Paystack and becomes `completed` or `failed` through
   a signed transfer webhook.
9. Paystack test mode simulates transfers and does not move real money.

## Setup

Requirements: Node.js, npm, MongoDB, and a Paystack test secret key.

Create `.env`:

```dotenv
NODE_ENV=development
PORT=4000
MONGO_URI=mongodb://localhost:27017/achievements
PAYSTACK_SECRET_KEY=sk_test_your_key
PAYSTACK_BASE_URL=https://api.paystack.co
```

`PORT` and `PAYSTACK_BASE_URL` are optional and use the values shown by default.

Install and start locally:

```bash
npm install
npm run start:dev
```

For a production build:

```bash
npm run build
npm start
```

The API defaults to `http://localhost:4000/api/v1`.

## API documentation

Swagger contains the complete endpoint list, parameters, request examples, and
response schemas:

```text
http://localhost:4000/docs/v1
```

## Paystack

- Disable transfer OTP so cashback transfers can run automatically.
- Use a public HTTPS URL, such as ngrok, for local webhook testing.
- Configure the dashboard webhook as:

  ```text
  https://<public-host>/api/v1/payment/webhook
  ```

The webhook verifies `x-paystack-signature` and handles `transfer.success`,
`transfer.failed`, and `transfer.reversed`.

## Docker

Set `PAYSTACK_SECRET_KEY` in `.env`, then run:

```bash
docker compose up --build
```

This starts the API and MongoDB. MongoDB data is retained in the
`mongodb_data` volume.

```bash
docker compose down
```

## Tests

```bash
npm test             # unit tests
npm run test:e2e     # endpoint and event integration tests
npm run test:cov     # unit coverage report
npm run lint         # lint
npm run build        # production build verification
```

Tests cover validation, controllers, services, schemas, achievement thresholds,
event payloads and ordering, idempotency, Paystack errors, webhook signatures,
cashback status changes, and application event registration.

